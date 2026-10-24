import { encodeBase64, readSnapshotHeader, SNAPSHOT_FORMAT_VERSION } from "$shared/apis/enhancer-snapshot.ts";
import { ENHANCER_ENDPOINTS } from "$shared/enhancer-environment.ts";
import type { Logger } from "$shared/logger/logger.ts";
import type { AggregateSnapshotDatabase } from "$shared/worker/enhancer-api/aggregate-snapshot.database.ts";
import type {
	EnhancerAggregateHeadEvent,
	EnhancerAggregateTopic,
	EnhancerAggregateUpdatedEvent,
	EnhancerBufferedEvent,
	EnhancerChannelAvailableEvent,
	EnhancerChannelUnavailableEvent,
	EnhancerMessageEvent,
	EnhancerStreamerWatchTimeData,
	EnhancerSubscription,
	EnhancerWebSocketMessage,
	XayoWatchtimePeriod,
} from "$types/apis/enhancer.apis.ts";
import type { EnhancerEndpoints } from "$types/shared/enhancer-environment.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type {
	AggregateAccountEntry,
	AggregateBadgeEntry,
	AggregateData,
	AggregateScope,
	AggregateSeed,
	AggregateSnapshotFile,
	EnhancerApiClient,
	SubscriptionState,
} from "$types/shared/worker/enhancer-api-worker.types.ts";
import type { WorkerBroadcast } from "$types/shared/worker/worker.types.ts";

export class EnhancerApiService {
	private static readonly CONFIRMATION_TIMEOUT_MS = 5000;
	private static readonly HEARTBEAT_INTERVAL_MS = 25_000;
	private static readonly MAX_SEEN_CURSORS = 1000;
	private static readonly MAX_SUBSCRIPTIONS = 32;
	private static readonly MAX_OVERLAY_ENTRIES = 20_000;

	private readonly clients = new Map<string, EnhancerApiClient>();
	private readonly subscriptions = new Map<EnhancerAggregateTopic, SubscriptionState>();
	private readonly pendingSubscriptions = new Map<EnhancerAggregateTopic, SubscriptionState>();
	private readonly confirmedGlobals = new Set<PlatformType>();
	private socket: WebSocket | null = null;
	private serverReady = false;
	private connectionPromise: Promise<void> | null = null;
	private heartbeat: ReturnType<typeof setInterval> | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private reconnectAttempt = 0;
	private clientGeneration = 0;
	private pendingSubscription: SubscriptionState | null = null;

	constructor(
		private readonly logger: Logger,
		private readonly version = "unknown",
		private readonly store?: AggregateSnapshotDatabase,
		private endpoints: EnhancerEndpoints = ENHANCER_ENDPOINTS.production,
	) {
		chrome.tabs.onRemoved.addListener((tabId) => this.removeTabClients(tabId));
	}

	async initialize(
		tabId: number,
		frameId: number,
		clientId: string,
		platform: PlatformType,
		knownHash?: string,
	): Promise<AggregateSeed> {
		this.logger.debug("Initializing client", { tabId, frameId, clientId, platform });
		const client = this.registerClient(tabId, frameId, clientId, platform);
		const topic = this.getTopic(platform, "GLOBAL");
		this.rememberKnownHash(client, topic, knownHash);
		const state = await this.awaitSeed(client, "GLOBAL", () => this.bootstrap(this.subscribeClient(client, "GLOBAL")));
		const seed = state ? this.createSeed(state, client) : null;
		if (!seed) throw new Error(`Global ${platform} aggregate was not found`);
		return seed;
	}

	async joinChannel(
		tabId: number,
		frameId: number,
		clientId: string,
		platform: PlatformType,
		externalId: string,
		knownHash?: string,
	): Promise<AggregateSeed | null> {
		if (!externalId) throw new Error("Channel external ID is required");
		this.logger.debug("Joining channel", { tabId, frameId, clientId, platform, externalId });
		const client = this.registerClient(tabId, frameId, clientId, platform);
		const topic = this.getTopic(platform, "CHANNEL", externalId);
		if (client.channelTopic && client.channelTopic !== topic) this.unsubscribeClient(client, client.channelTopic);
		this.rememberKnownHash(client, topic, knownHash);
		const subscribed = this.subscribeClient(client, "CHANNEL", externalId);
		client.channelTopic = subscribed.topic;
		const state = await this.awaitSeed(client, "CHANNEL", () => this.bootstrap(subscribed));
		return state ? this.createSeed(state, client) : null;
	}

	private async awaitSeed(
		client: EnhancerApiClient,
		scope: AggregateScope,
		load: () => Promise<SubscriptionState | null>,
	): Promise<SubscriptionState | null> {
		client.awaitingScopes.add(scope);
		try {
			return await load();
		} finally {
			client.awaitingScopes.delete(scope);
		}
	}

	async getWatchTime(
		username: string,
		period: XayoWatchtimePeriod,
		platform: PlatformType,
	): Promise<EnhancerStreamerWatchTimeData[]> {
		if (!username) throw new Error("Username is required");
		const url = new URL(`https://xayo.pl/api/chatters/${encodeURIComponent(username)}/watchtime`);
		url.searchParams.set("period", period);
		url.searchParams.set("platform", platform);
		const response = await fetch(url, {
			headers: { Accept: "application/json" },
		});
		if (!response.ok) throw new Error(`Watchtime request failed with status ${response.status}`);
		return response.json() as Promise<EnhancerStreamerWatchTimeData[]>;
	}

	disconnect(_tabId: number, _frameId: number, clientId: string, _platform: PlatformType): void {
		this.unregisterClient(clientId);
	}

	setEndpoints(endpoints: EnhancerEndpoints): void {
		if (endpoints.api === this.endpoints.api && endpoints.websocket === this.endpoints.websocket) return;
		this.logger.info("Switching Enhancer API", endpoints.api);
		this.closeConnection();
		for (const state of this.subscriptions.values()) {
			state.active = false;
			this.releaseSubscription(state);
		}
		this.clients.clear();
		this.subscriptions.clear();
		this.pendingSubscriptions.clear();
		this.reconnectAttempt = 0;
		this.endpoints = endpoints;
	}

	private rememberKnownHash(client: EnhancerApiClient, topic: EnhancerAggregateTopic, knownHash?: string): void {
		if (knownHash) client.sentHashes.set(topic, knownHash);
		else client.sentHashes.delete(topic);
	}

	private registerClient(tabId: number, frameId: number, clientId: string, platform: PlatformType): EnhancerApiClient {
		const existing = this.clients.get(clientId);
		if (existing) {
			existing.tabId = tabId;
			existing.frameId = frameId;
			existing.generation = ++this.clientGeneration;
			return existing;
		}
		for (const client of this.clients.values()) {
			if (client.tabId === tabId && client.frameId === frameId && client.platform === platform) {
				this.unregisterClient(client.clientId);
			}
		}
		const client: EnhancerApiClient = {
			tabId,
			frameId,
			clientId,
			platform,
			topics: new Set(),
			generation: ++this.clientGeneration,
			sentHashes: new Map(),
			awaitingScopes: new Set(),
		};
		this.clients.set(clientId, client);
		return client;
	}

	private subscribeClient(client: EnhancerApiClient, scope: AggregateScope, externalId?: string): SubscriptionState {
		const topic = this.getTopic(client.platform, scope, externalId);
		let state = this.subscriptions.get(topic);
		if (!state) {
			const platform = client.platform.toUpperCase() as Uppercase<PlatformType>;
			const subscription: EnhancerSubscription =
				scope === "GLOBAL" ? { scope, platform } : { scope, platform, externalId: externalId as string };
			state = {
				topic,
				platform: client.platform,
				scope,
				externalId,
				subscription,
				subscribers: new Set(),
				confirmed: false,
				rejected: false,
				requested: false,
				active: true,
				replaying: false,
				replayComplete: false,
				restoring: false,
				transitioning: false,
				snapshotChanged: false,
				forceFresh: false,
				generation: 0,
				eventBuffer: [],
				confirmationRetry: null,
				confirmationWaiters: new Set(),
				syncWaiters: new Set(),
				seenCursors: new Set(),
				processing: Promise.resolve(),
			};
			this.subscriptions.set(topic, state);
			this.logger.debug("Created topic", { topic, subscriptionCount: this.subscriptions.size });
		}
		if (scope === "CHANNEL" && !state.confirmed) this.pendingSubscriptions.set(state.topic, state);
		state.active = true;
		state.subscribers.add(client.clientId);
		client.topics.add(state.topic);
		return state;
	}

	private unsubscribeClient(client: EnhancerApiClient, topic: EnhancerAggregateTopic): void {
		const state = this.subscriptions.get(topic);
		client.topics.delete(topic);
		client.sentHashes.delete(topic);
		if (client.channelTopic === topic) client.channelTopic = undefined;
		if (!state) return;
		state.subscribers.delete(client.clientId);
		if (state.subscribers.size > 0) return;
		if (this.pendingSubscription === state && !state.confirmed) this.closeConnection();
		state.active = false;
		this.unsubscribe(state);
		this.releaseSubscription(state);
		this.subscriptions.delete(state.topic);
		this.pendingSubscriptions.delete(state.topic);
		if (this.subscriptions.size === 0) this.closeConnection();
		else this.sendNextSubscription();
	}

	private unregisterClient(clientId: string): void {
		const client = this.clients.get(clientId);
		if (!client) return;
		for (const topic of Array.from(client.topics)) this.unsubscribeClient(client, topic);
		this.clients.delete(clientId);
	}

	private removeTabClients(tabId: number): void {
		for (const client of Array.from(this.clients.values())) {
			if (client.tabId === tabId) this.unregisterClient(client.clientId);
		}
	}

	private getTopic(platform: PlatformType, scope: AggregateScope, externalId?: string): EnhancerAggregateTopic {
		const platformName = platform.toUpperCase() as Uppercase<PlatformType>;
		return (
			scope === "GLOBAL" ? `global:${platformName}` : `channel:${platformName}:${externalId}`
		) as EnhancerAggregateTopic;
	}

	private async bootstrap(state: SubscriptionState): Promise<SubscriptionState | null> {
		const root = this.resolveState(state);
		if (root.bootstrapPromise) return root.bootstrapPromise;
		if (root.aggregate && root.confirmed && !root.replaying) return root;
		if (root.aggregate === null && root.rejected) return null;

		root.bootstrapPromise = (async () => {
			if (!root.aggregate) await this.restoreStored(root);
			let current = this.resolveState(root);
			await this.ensureConnection();
			if (!current.active) return null;
			if (!current.confirmed) this.sendSubscription(current);

			await this.waitForConfirmation(current);
			current = this.resolveState(current);
			if (current.rejected) return null;
			if (!current.confirmed) throw new Error(`Enhancer subscription confirmation timed out for ${current.topic}`);
			if (current.replaying) await this.waitForSynchronization(current);
			current = this.resolveState(current);
			return current.aggregate ? current : null;
		})().finally(() => {
			root.bootstrapPromise = undefined;
		});

		return root.bootstrapPromise;
	}

	private async restoreStored(state: SubscriptionState): Promise<void> {
		if (!this.store) return;
		state.restoring = true;
		try {
			const stored = await this.store.get(state.topic);
			if (!stored || state.aggregate || stored.platform !== state.platform.toUpperCase()) return;
			state.aggregate = {
				channelId: stored.channelId,
				platform: stored.platform,
				epoch: stored.epoch,
				seq: stored.seq,
				snapshot: { hash: stored.hash, seq: stored.seq, bytes: stored.bytes },
				accounts: new Map(),
				badges: new Map(),
			};
		} catch (error) {
			this.logger.warn(`Failed to read stored aggregate for ${state.topic}:`, error);
		} finally {
			state.restoring = false;
		}
	}

	private ensureConnection(): Promise<void> {
		if (this.serverReady && this.socket?.readyState === WebSocket.OPEN) return Promise.resolve();
		if (this.connectionPromise) return this.connectionPromise;
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		this.connectionPromise = new Promise<void>((resolve, reject) => {
			const socket = new WebSocket(`${this.endpoints.websocket}?v=${encodeURIComponent(this.version)}`);
			this.socket = socket;
			let settled = false;
			const timeout = setTimeout(() => {
				if (settled) return;
				settled = true;
				socket.close();
				reject(new Error("Enhancer WebSocket readiness timed out"));
			}, EnhancerApiService.CONFIRMATION_TIMEOUT_MS);

			socket.addEventListener("message", (event) => {
				if (this.socket !== socket || typeof event.data !== "string") return;
				let message: EnhancerWebSocketMessage;
				try {
					message = JSON.parse(event.data) as EnhancerWebSocketMessage;
				} catch (error) {
					this.logger.warn("Invalid Enhancer WebSocket message:", error);
					return;
				}
				this.logger.debug("Received WebSocket message", "type" in message ? message.type : "error");
				if ("type" in message && message.type === "connection.ready") {
					this.serverReady = true;
					this.reconnectAttempt = 0;
					this.startHeartbeat();
					for (const state of this.subscriptions.values()) this.sendSubscription(state);
					if (!settled) {
						settled = true;
						clearTimeout(timeout);
						resolve();
					}
					return;
				}
				this.handleSocketMessage(message);
			});

			socket.addEventListener("close", () => {
				clearTimeout(timeout);
				if (!settled) {
					settled = true;
					reject(new Error("Enhancer WebSocket closed before it was ready"));
				}
				this.handleSocketClose(socket);
			});
			socket.addEventListener("error", () => this.logger.warn("Enhancer WebSocket error"));
		}).finally(() => {
			this.connectionPromise = null;
		});

		return this.connectionPromise;
	}

	private handleSocketMessage(message: EnhancerWebSocketMessage): void {
		if (!("type" in message)) {
			this.logger.warn(`Enhancer WebSocket error: ${message.error.code}: ${message.error.message}`);
			if (message.error.code === "NOT_FOUND") this.rejectPendingSubscription();
			else this.closeConnection();
			return;
		}

		if (message.type === "subscription.confirmed") {
			const requestedState = this.pendingSubscription ?? this.subscriptions.get(message.topic) ?? undefined;
			if (!requestedState) return;
			const requestedTopic = requestedState.topic;
			const state =
				requestedState.topic === message.topic ? requestedState : this.renameTopic(requestedState, message.topic);
			state.confirmed = true;
			state.rejected = false;
			this.pendingSubscriptions.delete(requestedTopic);
			this.pendingSubscriptions.delete(message.topic);
			if (this.pendingSubscription === requestedState) this.pendingSubscription = null;
			this.confirmSubscription(requestedState);
			if (state !== requestedState) this.confirmSubscription(state);
			if (state.scope === "GLOBAL") this.confirmedGlobals.add(state.platform);
			this.sendNextSubscription();
			return;
		}

		if (message.type === "aggregate.head") {
			const state = this.subscriptions.get(message.topic);
			if (!state?.active || !state.replaying) return;
			state.loading = this.loadHead(state, message, state.generation);
			return;
		}

		if (message.type === "replay.complete") {
			const state = this.subscriptions.get(message.topic);
			if (!state) return;
			state.replayComplete = true;
			void this.finishReplay(state, state.generation);
			return;
		}

		if (message.type === "aggregate.updated") {
			this.handleAggregateEvent(message);
			return;
		}

		if (message.type === "message") {
			this.handleMessageEvent(message);
			return;
		}

		if (message.type === "channel.available") {
			this.handleChannelAvailable(message);
			return;
		}

		if (message.type === "channel.unavailable") {
			this.handleChannelUnavailable(message);
			return;
		}

		if (message.type === "error") {
			this.logger.warn(`Enhancer WebSocket protocol error: ${message.code}`);
			this.rejectPendingSubscription();
		}
	}

	private renameTopic(state: SubscriptionState, topic: EnhancerAggregateTopic): SubscriptionState {
		const previousTopic = state.topic;
		const existing = this.subscriptions.get(topic);
		if (existing && existing !== state) {
			if (state.aggregate && !existing.aggregate) existing.aggregate = state.aggregate;
			this.subscriptions.delete(previousTopic);
			this.pendingSubscriptions.delete(previousTopic);
			state.topic = topic;
			state.redirect = existing;
			state.active = false;
			state.aggregate = existing.aggregate;
			state.cursor = existing.cursor;
			state.replaying = false;
			for (const clientId of state.subscribers) {
				existing.subscribers.add(clientId);
				const client = this.clients.get(clientId);
				if (!client) continue;
				client.topics.delete(previousTopic);
				client.topics.add(topic);
				client.sentHashes.delete(previousTopic);
				if (client.channelTopic === previousTopic) client.channelTopic = topic;
			}
			return existing;
		}
		this.subscriptions.delete(previousTopic);
		this.pendingSubscriptions.delete(previousTopic);
		state.topic = topic;
		if (state.scope === "CHANNEL") {
			const prefix = `channel:${state.platform.toUpperCase()}:`;
			state.externalId = topic.startsWith(prefix) ? topic.slice(prefix.length) : state.externalId;
			state.subscription = {
				scope: "CHANNEL",
				platform: state.platform.toUpperCase() as Uppercase<PlatformType>,
				externalId: state.externalId as string,
			};
		}
		this.subscriptions.set(topic, state);
		for (const clientId of state.subscribers) {
			const client = this.clients.get(clientId);
			if (!client) continue;
			client.topics.delete(previousTopic);
			client.topics.add(topic);
			const sentHash = client.sentHashes.get(previousTopic);
			client.sentHashes.delete(previousTopic);
			if (sentHash) client.sentHashes.set(topic, sentHash);
			if (client.channelTopic === previousTopic) client.channelTopic = topic;
		}
		return state;
	}

	private resolveState(state: SubscriptionState): SubscriptionState {
		let current = state;
		while (current.redirect) current = current.redirect;
		return current;
	}

	private confirmSubscription(state: SubscriptionState): void {
		if (state.confirmationRetry) clearTimeout(state.confirmationRetry);
		state.confirmationRetry = null;
		for (const resolve of state.confirmationWaiters) resolve();
		state.confirmationWaiters.clear();
	}

	private async loadHead(
		state: SubscriptionState,
		head: EnhancerAggregateHeadEvent,
		generation: number,
	): Promise<void> {
		const current = state.aggregate;
		if (!head.resync && current && current.epoch === head.epoch && current.seq === head.from) return;
		const snapshot =
			current?.snapshot.hash === head.snapshot.hash
				? { ...current.snapshot, seq: head.snapshot.seq }
				: await this.fetchSnapshot(head);
		if (state.generation !== generation) return;
		const { header } = readSnapshotHeader(snapshot.bytes);
		state.aggregate = {
			channelId: header.channelId,
			platform: header.platform,
			epoch: head.epoch,
			seq: head.snapshot.seq,
			snapshot,
			accounts: new Map(),
			badges: new Map(),
		};
		state.snapshotChanged = true;
		void this.persist(state, state.aggregate);
	}

	private async fetchSnapshot(head: EnhancerAggregateHeadEvent): Promise<AggregateSnapshotFile> {
		const response = await fetch(new URL(head.snapshot.path, this.endpoints.api));
		if (!response.ok) throw new Error(`Enhancer snapshot request failed with status ${response.status}`);
		const bytes = new Uint8Array(await response.arrayBuffer());
		const { header } = readSnapshotHeader(bytes);
		if (header.topic.toLowerCase() !== head.topic.toLowerCase()) throw new Error("Enhancer snapshot topic mismatch");
		return { hash: head.snapshot.hash, seq: head.snapshot.seq, bytes };
	}

	private async persist(state: SubscriptionState, data: AggregateData): Promise<void> {
		if (!this.store) return;
		try {
			await this.store.put({
				topic: state.topic,
				formatVersion: SNAPSHOT_FORMAT_VERSION,
				scope: state.scope,
				hash: data.snapshot.hash,
				seq: data.snapshot.seq,
				epoch: data.epoch,
				channelId: data.channelId,
				platform: data.platform,
				lastUsedAt: Date.now(),
				bytes: data.snapshot.bytes,
			});
		} catch (error) {
			this.logger.warn(`Failed to store aggregate for ${state.topic}:`, error);
		}
	}

	private async finishReplay(state: SubscriptionState, generation: number): Promise<void> {
		if (!state.replayComplete) return;
		try {
			await state.loading;
		} catch (error) {
			this.logger.error(`Failed to load Enhancer snapshot for ${state.topic}:`, error);
			if (state.generation === generation) this.closeConnection();
			return;
		}
		if (state.generation !== generation || !state.replaying) return;
		await state.processing;
		state.replaying = false;
		state.loading = undefined;
		const buffered = state.eventBuffer;
		state.eventBuffer = [];
		const aggregateEvents = buffered
			.filter((event): event is EnhancerAggregateUpdatedEvent => event.type === "aggregate.updated")
			.sort((left, right) => left.seq - right.seq);
		const otherEvents = buffered
			.filter((event) => event.type !== "aggregate.updated")
			.sort((left, right) => this.compareCursors(left.cursor as string, right.cursor as string));

		const snapshotChanged = state.snapshotChanged;
		state.snapshotChanged = false;
		const applied: EnhancerAggregateUpdatedEvent[] = [];
		for (const event of aggregateEvents) {
			const result = this.applyAggregateEvent(state, event);
			if (result === "applied") applied.push(event);
			if (result === "gap") break;
		}
		if (snapshotChanged) await this.broadcastSeed(state);
		else for (const event of applied) await this.broadcastPatch(state, event);

		for (const event of otherEvents) {
			if (event.type === "channel.available") this.applyChannelAvailable(event);
			else if (event.type === "channel.unavailable")
				await this.applyChannelUnavailable(state, event, Boolean(state.bootstrapPromise));
			else if (event.type === "message") this.processMessageEvent(state, event);
		}
		await state.processing;
		this.resolveSynchronization(state);
	}

	private applyAggregateEvent(
		state: SubscriptionState,
		event: EnhancerAggregateUpdatedEvent,
	): "applied" | "skipped" | "gap" {
		const data = state.aggregate;
		if (!data) return "skipped";
		if (event.epoch !== data.epoch || event.seq > data.seq + 1) {
			this.requestResync(state, event.epoch !== data.epoch);
			return "gap";
		}
		if (event.seq <= data.seq) return "skipped";
		const { accounts, badges } = this.toEntries(event);
		for (const [externalId, account] of accounts) data.accounts.set(externalId, account);
		for (const [badgeId, badge] of badges) data.badges.set(badgeId, badge);
		data.seq = event.seq;
		if (data.accounts.size + data.badges.size > EnhancerApiService.MAX_OVERLAY_ENTRIES) {
			this.requestResync(state, true);
		}
		return "applied";
	}

	private toEntries(event: EnhancerAggregateUpdatedEvent): {
		accounts: AggregateAccountEntry[];
		badges: AggregateBadgeEntry[];
	} {
		return {
			accounts: [
				...(event.externalIdsRemove ?? []).map((externalId): AggregateAccountEntry => [externalId, null]),
				...event.accountsUpsert.map((account): AggregateAccountEntry => [account.externalId, account]),
			],
			badges: [
				...event.badgeIdsRemove.map((badgeId): AggregateBadgeEntry => [badgeId, null]),
				...event.badgesUpsert.map((badge): AggregateBadgeEntry => [badge.badgeId, badge]),
			],
		};
	}

	private requestResync(state: SubscriptionState, fresh: boolean): void {
		this.logger.debug("Resynchronizing topic", { topic: state.topic, fresh });
		state.forceFresh ||= fresh;
		if (!state.confirmed && !state.requested) return;
		this.unsubscribe(state);
		state.confirmed = false;
		this.sendNextSubscription();
	}

	private handleAggregateEvent(event: EnhancerAggregateUpdatedEvent): void {
		const state = this.subscriptions.get(event.topic);
		if (!state?.confirmed) return;
		if (state.replaying) {
			state.eventBuffer.push(event);
			return;
		}
		state.processing = state.processing.then(async () => {
			if (!state.active || state.replaying) return;
			if (this.applyAggregateEvent(state, event) !== "applied") return;
			try {
				await this.broadcastPatch(state, event);
			} catch (error) {
				this.logger.error(`Failed to broadcast Enhancer update for ${state.topic}:`, error);
			}
		});
	}

	private handleMessageEvent(event: EnhancerMessageEvent): void {
		const state = this.subscriptions.get(this.getMessageTopic(event));
		if (!state?.confirmed) return;
		if (state.replaying) state.eventBuffer.push(event);
		else this.processMessageEvent(state, event);
	}

	private processMessageEvent(state: SubscriptionState, event: EnhancerMessageEvent): void {
		state.processing = state.processing.then(async () => {
			if (state.seenCursors.has(event.cursor) || (state.cursor && this.compareCursors(event.cursor, state.cursor) <= 0))
				return;
			state.seenCursors.add(event.cursor);
			state.cursor = event.cursor;
			if (state.seenCursors.size > EnhancerApiService.MAX_SEEN_CURSORS) {
				const oldest = state.seenCursors.values().next().value;
				if (oldest) state.seenCursors.delete(oldest);
			}
			try {
				await this.broadcastMessage(state, event);
			} catch (error) {
				this.logger.error(`Failed to process Enhancer event for ${state.topic}:`, error);
			}
		});
	}

	private handleChannelAvailable(event: EnhancerChannelAvailableEvent): void {
		const state = this.pendingSubscriptions.get(event.topic) ?? this.subscriptions.get(event.topic);
		if (!state?.active) return;
		if (state.replaying || state.transitioning) {
			state.eventBuffer.push(event);
			return;
		}
		this.applyChannelAvailable(event);
	}

	private applyChannelAvailable(event: EnhancerChannelAvailableEvent): void {
		const state = this.pendingSubscriptions.get(event.topic);
		if (!state?.active) return;
		if (state.bootstrapPromise) {
			const retry = () => this.activatePendingChannel(state, event.topic);
			void state.bootstrapPromise.then(retry, retry);
			return;
		}
		this.activatePendingChannel(state, event.topic);
	}

	private activatePendingChannel(state: SubscriptionState, topic: EnhancerAggregateTopic): void {
		const current = this.resolveState(state);
		if (!current.active || current.bootstrapPromise || current.aggregate !== null || !current.rejected) return;
		current.aggregate = undefined;
		current.rejected = false;
		void this.bootstrap(current)
			.then((ready) => {
				if (ready) return this.broadcastSeed(ready);
			})
			.catch((error) => this.logger.error(`Failed to activate ${topic}:`, error));
	}

	private handleChannelUnavailable(event: EnhancerChannelUnavailableEvent): void {
		const state = this.subscriptions.get(event.topic);
		if (!state?.active) return;
		if (state.replaying || state.transitioning) {
			state.eventBuffer.push(event);
			return;
		}
		void this.applyChannelUnavailable(state, event, Boolean(state.bootstrapPromise));
	}

	private async applyChannelUnavailable(
		state: SubscriptionState,
		event: EnhancerChannelUnavailableEvent,
		deferBootstrap: boolean,
	): Promise<void> {
		state.transitioning = true;
		try {
			await this.transitionChannelUnavailable(state, event, deferBootstrap);
		} finally {
			state.transitioning = false;
			if (!state.replaying && state.eventBuffer.length > 0) {
				const buffered = state.eventBuffer;
				state.eventBuffer = [];
				for (const pending of buffered) this.redeliver(pending);
			}
		}
	}

	private redeliver(event: EnhancerBufferedEvent): void {
		if (event.type === "aggregate.updated") this.handleAggregateEvent(event);
		else if (event.type === "message") this.handleMessageEvent(event);
		else if (event.type === "channel.available") this.handleChannelAvailable(event);
		else this.handleChannelUnavailable(event);
	}

	private async transitionChannelUnavailable(
		state: SubscriptionState,
		event: EnhancerChannelUnavailableEvent,
		deferBootstrap: boolean,
	): Promise<void> {
		await state.processing;
		state.aggregate = null;
		await this.broadcastSeed(state, event.replacementTopic);
		this.unsubscribe(state);
		state.confirmed = false;
		state.replaying = false;
		state.seenCursors.clear();
		void this.store?.delete(state.topic).catch(() => {});

		if (event.reason === "archived") {
			state.rejected = true;
			this.pendingSubscriptions.set(state.topic, state);
			return;
		}

		if (!event.replacementTopic) return;
		state.rejected = false;
		state.aggregate = undefined;
		state.cursor = undefined;
		const replacement = this.renameTopic(state, event.replacementTopic);
		if (replacement !== state) {
			if (replacement.aggregate) await this.broadcastSeed(replacement);
			return;
		}
		this.pendingSubscriptions.set(state.topic, state);
		if (deferBootstrap) {
			this.scheduleBootstrap(state);
			return;
		}
		const ready = await this.bootstrap(state);
		if (ready) await this.broadcastSeed(ready);
	}

	private scheduleBootstrap(state: SubscriptionState): void {
		void Promise.resolve().then(async () => {
			const running = state.bootstrapPromise;
			if (running) await running.catch(() => null);
			const current = this.resolveState(state);
			if (!current.active || current.aggregate !== undefined || current.rejected) return;
			try {
				const ready = await this.bootstrap(current);
				if (ready) await this.broadcastSeed(ready);
			} catch (error) {
				this.logger.error(`Failed to bootstrap ${current.topic}:`, error);
			}
		});
	}

	private getMessageTopic(event: EnhancerMessageEvent): EnhancerAggregateTopic {
		const { target } = event;
		return (
			target.scope === "GLOBAL"
				? `global:${target.platform}`
				: `${target.scope.toLowerCase()}:${target.platform}:${target.externalId}`
		) as EnhancerAggregateTopic;
	}

	private rejectPendingSubscription(): void {
		const pending = this.pendingSubscription;
		if (pending) {
			pending.rejected = true;
			pending.aggregate = null;
			this.pendingSubscriptions.set(pending.topic, pending);
			this.releaseSubscription(pending);
			if (pending.scope === "CHANNEL") void this.store?.delete(pending.topic).catch(() => {});
		}
		this.pendingSubscription = null;
		this.sendNextSubscription();
	}

	private releaseSubscription(state: SubscriptionState): void {
		state.requested = false;
		state.replaying = false;
		if (state.confirmationRetry) clearTimeout(state.confirmationRetry);
		state.confirmationRetry = null;
		for (const resolve of state.confirmationWaiters) resolve();
		state.confirmationWaiters.clear();
		this.resolveSynchronization(state);
	}

	private sendSubscription(state: SubscriptionState): void {
		if (
			state.requested ||
			state.rejected ||
			state.restoring ||
			!state.active ||
			!this.serverReady ||
			this.socket?.readyState !== WebSocket.OPEN
		) {
			return;
		}
		if (state.scope !== "GLOBAL" && !this.confirmedGlobals.has(state.platform)) return;
		if (this.getServerSubscriptionCount() >= EnhancerApiService.MAX_SUBSCRIPTIONS) return;
		if (this.pendingSubscription && this.pendingSubscription !== state) return;
		this.pendingSubscription = state;
		state.requested = true;
		state.generation++;
		state.replaying = true;
		state.replayComplete = false;
		state.loading = undefined;
		state.snapshotChanged = false;
		state.eventBuffer = [];
		const position =
			state.aggregate && !state.forceFresh ? { epoch: state.aggregate.epoch, seq: state.aggregate.seq } : {};
		state.forceFresh = false;
		this.socket.send(JSON.stringify({ type: "subscribe", subscription: state.subscription, state: position }));
		this.scheduleConfirmationRetry(state);
	}

	private sendNextSubscription(): void {
		if (this.pendingSubscription) return;
		const next = [...this.subscriptions.values()]
			.filter(
				(state) =>
					state.active &&
					state.aggregate !== null &&
					!state.restoring &&
					!state.confirmed &&
					!state.rejected &&
					(state.scope === "GLOBAL" || this.confirmedGlobals.has(state.platform)),
			)
			.sort((left, right) => Number(right.scope === "GLOBAL") - Number(left.scope === "GLOBAL"))[0];
		if (next) this.sendSubscription(next);
	}

	private getServerSubscriptionCount(): number {
		return [...this.subscriptions.values()].filter((state) => state.confirmed || state.requested).length;
	}

	private unsubscribe(state: SubscriptionState): void {
		if (this.serverReady && this.socket?.readyState === WebSocket.OPEN && (state.confirmed || state.requested)) {
			this.socket.send(JSON.stringify({ type: "unsubscribe", subscription: state.subscription }));
		}
		state.requested = false;
		if (this.pendingSubscription === state) this.pendingSubscription = null;
		if (state.confirmationRetry) clearTimeout(state.confirmationRetry);
		state.confirmationRetry = null;
	}

	private scheduleConfirmationRetry(state: SubscriptionState): void {
		if (state.confirmationRetry) clearTimeout(state.confirmationRetry);
		state.confirmationRetry = setTimeout(() => {
			state.confirmationRetry = null;
			if (!state.active || state.confirmed || !this.serverReady) return;
			this.releaseSubscription(state);
			if (this.pendingSubscription === state) this.pendingSubscription = null;
			this.closeConnection();
		}, EnhancerApiService.CONFIRMATION_TIMEOUT_MS);
	}

	private waitForConfirmation(state: SubscriptionState): Promise<void> {
		if (state.confirmed) return Promise.resolve();
		return new Promise((resolve) => {
			const finish = () => {
				clearTimeout(timeout);
				state.confirmationWaiters.delete(finish);
				resolve();
			};
			const timeout = setTimeout(finish, EnhancerApiService.CONFIRMATION_TIMEOUT_MS);
			state.confirmationWaiters.add(finish);
		});
	}

	private waitForSynchronization(state: SubscriptionState): Promise<void> {
		if (!state.replaying) return Promise.resolve();
		return new Promise((resolve) => state.syncWaiters.add(resolve));
	}

	private resolveSynchronization(state: SubscriptionState): void {
		for (const resolve of state.syncWaiters) resolve();
		state.syncWaiters.clear();
	}

	private createSeed(state: SubscriptionState, client: EnhancerApiClient): AggregateSeed | null {
		const data = state.aggregate;
		if (!data) return null;
		const known = client.sentHashes.get(state.topic) === data.snapshot.hash;
		client.sentHashes.set(state.topic, data.snapshot.hash);
		if (!known) data.snapshot.base64 ??= encodeBase64(data.snapshot.bytes);
		return {
			topic: state.topic,
			hash: data.snapshot.hash,
			seq: data.seq,
			...(known ? {} : { bytes: data.snapshot.base64 }),
			accounts: [...data.accounts],
			badges: [...data.badges],
		};
	}

	private async broadcastSeed(state: SubscriptionState, replacementTopic?: EnhancerAggregateTopic): Promise<void> {
		const skip = (client: EnhancerApiClient) => client.awaitingScopes.has(state.scope) && !replacementTopic;
		await this.broadcastToSubscribers(state, skip, (client) => ({
			type: "enhancer-api-updated",
			payload: {
				platform: state.platform,
				clientId: client.clientId,
				scope: state.scope,
				topic: state.topic,
				seed: this.createSeed(state, client),
				replacementTopic,
			},
		}));
	}

	private async broadcastPatch(state: SubscriptionState, event: EnhancerAggregateUpdatedEvent): Promise<void> {
		const { accounts, badges } = this.toEntries(event);
		await this.broadcastToSubscribers(state, undefined, (client) => ({
			type: "enhancer-api-patch",
			payload: {
				platform: state.platform,
				clientId: client.clientId,
				topic: state.topic,
				seq: event.seq,
				accounts,
				badges,
			},
		}));
	}

	private async broadcastMessage(state: SubscriptionState, message: EnhancerMessageEvent): Promise<void> {
		await this.broadcastToSubscribers(state, undefined, (client) => ({
			type: "enhancer-api-message",
			payload: { platform: state.platform, clientId: client.clientId, topic: state.topic, message },
		}));
	}

	private async broadcastToSubscribers(
		state: SubscriptionState,
		skip: ((client: EnhancerApiClient) => boolean) | undefined,
		createMessage: (client: EnhancerApiClient) => WorkerBroadcast,
	): Promise<void> {
		const staleClients: Array<{ clientId: string; generation: number }> = [];
		await Promise.all(
			[...state.subscribers].map(async (clientId) => {
				const client = this.clients.get(clientId);
				if (!client || skip?.(client)) return;
				const generation = client.generation;
				try {
					await chrome.tabs.sendMessage(client.tabId, createMessage(client), { frameId: client.frameId });
				} catch {
					staleClients.push({ clientId, generation });
				}
			}),
		);
		for (const stale of staleClients) {
			if (this.clients.get(stale.clientId)?.generation === stale.generation) this.unregisterClient(stale.clientId);
		}
	}

	private compareCursors(left: string, right: string): number {
		const [leftMs, leftSequence] = left.split("-").map(BigInt);
		const [rightMs, rightSequence] = right.split("-").map(BigInt);
		if (leftMs !== rightMs) return leftMs > rightMs ? 1 : -1;
		if (leftSequence === rightSequence) return 0;
		return leftSequence > rightSequence ? 1 : -1;
	}

	private startHeartbeat(): void {
		if (this.heartbeat) clearInterval(this.heartbeat);
		this.heartbeat = setInterval(() => {
			if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ type: "ping" }));
		}, EnhancerApiService.HEARTBEAT_INTERVAL_MS);
	}

	private handleSocketClose(socket: WebSocket): void {
		if (this.socket && this.socket !== socket) return;
		this.serverReady = false;
		this.socket = null;
		this.pendingSubscription = null;
		if (this.heartbeat) clearInterval(this.heartbeat);
		this.heartbeat = null;
		this.resetSubscriptions();
		if (this.reconnectTimer || this.subscriptions.size === 0) return;
		const delay = Math.min(1000 * 2 ** this.reconnectAttempt, 30_000) + Math.floor(Math.random() * 500);
		this.reconnectAttempt++;
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			void this.ensureConnection().catch((error) => this.logger.warn("Failed to reconnect Enhancer WebSocket:", error));
		}, delay);
	}

	private closeConnection(): void {
		if (this.heartbeat) clearInterval(this.heartbeat);
		if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
		this.heartbeat = null;
		this.reconnectTimer = null;
		this.serverReady = false;
		this.pendingSubscription = null;
		this.resetSubscriptions();
		const socket = this.socket;
		this.socket = null;
		socket?.close();
	}

	private resetSubscriptions(): void {
		this.confirmedGlobals.clear();
		for (const state of this.subscriptions.values()) {
			state.confirmed = false;
			state.requested = false;
			state.generation++;
			state.replaying = false;
			state.replayComplete = false;
			state.loading = undefined;
			state.snapshotChanged = false;
			state.eventBuffer = [];
			if (state.confirmationRetry) clearTimeout(state.confirmationRetry);
			state.confirmationRetry = null;
		}
	}
}
