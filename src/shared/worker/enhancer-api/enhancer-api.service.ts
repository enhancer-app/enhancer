import type { Logger } from "$shared/logger/logger.ts";
import type {
	EnhancerAggregateResponse,
	EnhancerAggregateSnapshotEvent,
	EnhancerAggregateTopic,
	EnhancerAggregateUpdatedEvent,
	EnhancerApiError,
	EnhancerChannelAvailableEvent,
	EnhancerChannelDto,
	EnhancerChannelUnavailableEvent,
	EnhancerDataEvent,
	EnhancerMessageEvent,
	EnhancerStreamerWatchTimeData,
	EnhancerSubscription,
	EnhancerWebSocketMessage,
	XayoWatchtimePeriod,
} from "$types/apis/enhancer.apis.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type {
	AggregateMaps,
	AggregateScope,
	CachedAggregateSeed,
	EnhancerApiClient,
	SubscriptionState,
} from "$types/shared/worker/enhancer-api-worker.types.ts";
import type { WorkerBroadcast } from "$types/shared/worker/worker.types.ts";

export class EnhancerApiService {
	private static readonly HTTP_BASE_URL = "https://api.enhancer.at";
	private static readonly WEBSOCKET_URL = "wss://api.enhancer.at/v1/ws";
	private static readonly CONFIRMATION_TIMEOUT_MS = 5000;
	private static readonly HEARTBEAT_INTERVAL_MS = 25_000;
	private static readonly MAX_SEEN_CURSORS = 1000;
	private static readonly MAX_SUBSCRIPTIONS = 32;

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
	) {
		chrome.tabs.onRemoved.addListener((tabId) => this.removeTabClients(tabId));
	}

	async initialize(
		tabId: number,
		frameId: number,
		clientId: string,
		platform: PlatformType,
		seed?: CachedAggregateSeed,
	): Promise<CachedAggregateSeed> {
		this.logger.debug("Initializing client", { tabId, frameId, clientId, platform });
		const client = this.registerClient(tabId, frameId, clientId, platform);
		const state = this.subscribeClient(client, "GLOBAL");
		const aggregate = await this.bootstrap(state, seed);
		if (!aggregate) throw new Error(`Global ${platform} aggregate was not found`);
		return aggregate;
	}

	async joinChannel(
		tabId: number,
		frameId: number,
		clientId: string,
		platform: PlatformType,
		externalId: string,
		seed?: CachedAggregateSeed,
	): Promise<CachedAggregateSeed | null> {
		if (!externalId) throw new Error("Channel external ID is required");
		this.logger.debug("Joining channel", { tabId, frameId, clientId, platform, externalId });
		const client = this.registerClient(tabId, frameId, clientId, platform);
		const topic = this.getTopic(platform, "CHANNEL", externalId);
		if (client.channelTopic && client.channelTopic !== topic) this.unsubscribeClient(client, client.channelTopic);
		const state = this.subscribeClient(client, "CHANNEL", externalId);
		client.channelTopic = state.topic;
		return this.bootstrap(state, seed);
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
				seedCollecting: false,
				transitioning: false,
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
		for (const topic of [...client.topics]) this.unsubscribeClient(client, topic);
		this.clients.delete(clientId);
	}

	private removeTabClients(tabId: number): void {
		for (const client of [...this.clients.values()]) {
			if (client.tabId === tabId) this.unregisterClient(client.clientId);
		}
	}

	private getTopic(platform: PlatformType, scope: AggregateScope, externalId?: string): EnhancerAggregateTopic {
		const platformName = platform.toUpperCase() as Uppercase<PlatformType>;
		return (
			scope === "GLOBAL" ? `global:${platformName}` : `channel:${platformName}:${externalId}`
		) as EnhancerAggregateTopic;
	}

	private async bootstrap(state: SubscriptionState, seed?: CachedAggregateSeed): Promise<CachedAggregateSeed | null> {
		const root = this.resolveState(state);
		if (root.bootstrapPromise) return root.bootstrapPromise;
		if (root.aggregate && root.confirmed && !root.replaying && !root.snapshot) return this.createSeed(root);
		if (root.aggregate === null && root.rejected && !seed) return null;

		root.bootstrapPromise = (async () => {
			root.seedCollecting = true;
			if (seed) {
				this.installSeed(root, seed);
				const current = this.resolveState(root);
				await this.ensureConnection();
				if (!current.active) return null;
				if (!current.confirmed) this.sendSubscription(current);
			}

			const currentSeed = this.createSeed(this.resolveState(root));
			const seeds = await this.requestSeeds(this.resolveState(root).topic);
			const newest = [seed, currentSeed, ...seeds]
				.filter((candidate): candidate is CachedAggregateSeed => candidate !== null && candidate !== undefined)
				.sort((left, right) => this.compareCursors(right.cursor, left.cursor))[0];
			if (newest) this.installSeed(root, newest);

			let current = this.resolveState(root);
			if (!current.aggregate) {
				const fetchTopic = current.topic;
				const response = await this.fetchAggregate(
					current.platform,
					current.scope === "GLOBAL" ? "global" : (current.externalId as string),
				);
				current = this.resolveState(root);
				if (current.topic !== fetchTopic || current.rejected) {
					current.seedCollecting = false;
					return null;
				}
				if (!response) {
					current.aggregate = null;
					current.rejected = true;
					current.seedCollecting = false;
					this.pendingSubscriptions.set(current.topic, current);
					return null;
				}
				this.installAggregate(current, response, response.cursor);
			}

			current = this.resolveState(root);
			current.seedCollecting = false;
			current.rejected = false;
			await this.ensureConnection();
			if (!current.active) return null;
			if (!current.confirmed) this.sendSubscription(current);
			if (current.snapshot && this.isSnapshotComplete(current.snapshot))
				void this.installSnapshot(current, current.snapshot);
			else if (current.replayComplete && !current.snapshot) void this.finishReplay(current);

			await this.waitForConfirmation(current);
			current = this.resolveState(current);
			if (current.rejected) return null;
			if (!current.confirmed) throw new Error(`Enhancer subscription confirmation timed out for ${current.topic}`);
			if (current.replaying || current.snapshot || current.seedCollecting) await this.waitForSynchronization(current);
			return this.createSeed(this.resolveState(current));
		})().finally(() => {
			root.seedCollecting = false;
			root.bootstrapPromise = undefined;
		});

		return root.bootstrapPromise;
	}

	private ensureConnection(): Promise<void> {
		if (this.serverReady && this.socket?.readyState === WebSocket.OPEN) return Promise.resolve();
		if (this.connectionPromise) return this.connectionPromise;
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		this.connectionPromise = new Promise<void>((resolve, reject) => {
			const socket = new WebSocket(`${EnhancerApiService.WEBSOCKET_URL}?v=${encodeURIComponent(this.version)}`);
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
				this.logger.debug("Received WebSocket message", message);
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

		if (message.type === "replay.complete") {
			const state = this.subscriptions.get(message.topic);
			if (!state) return;
			state.replayComplete = true;
			if (!state.seedCollecting && !state.snapshot) void this.finishReplay(state);
			return;
		}

		if (message.type === "sync.required") {
			const state = this.subscriptions.get(message.topic);
			if (state) {
				state.replaying = true;
				state.replayComplete = false;
				state.snapshot = undefined;
			}
			return;
		}

		if (message.type === "aggregate.snapshot") {
			this.handleSnapshot(message);
			return;
		}

		if (message.type === "aggregate.updated" || message.type === "message") {
			this.handleDataEvent(message);
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
			if (
				state.aggregate &&
				(!existing.aggregate ||
					!existing.cursor ||
					(state.cursor && this.compareCursors(state.cursor, existing.cursor) > 0))
			) {
				existing.aggregate = state.aggregate;
				existing.cursor = state.cursor;
			}
			this.subscriptions.delete(previousTopic);
			this.pendingSubscriptions.delete(previousTopic);
			state.topic = topic;
			state.redirect = existing;
			state.active = false;
			state.aggregate = existing.aggregate;
			state.cursor = existing.cursor;
			state.replaying = false;
			state.snapshot = undefined;
			for (const clientId of state.subscribers) {
				existing.subscribers.add(clientId);
				const client = this.clients.get(clientId);
				if (!client) continue;
				client.topics.delete(previousTopic);
				client.topics.add(topic);
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

	private handleDataEvent(event: EnhancerDataEvent): void {
		const topic = event.type === "aggregate.updated" ? event.topic : this.getMessageTopic(event);
		const state = this.subscriptions.get(topic);
		if (!state?.confirmed) return;
		if (state.replaying || state.seedCollecting || state.snapshot) state.eventBuffer.push(event);
		else this.processDataEvent(state, event);
	}

	private processDataEvent(state: SubscriptionState, event: EnhancerDataEvent): void {
		state.processing = state.processing.then(async () => {
			if (state.seenCursors.has(event.cursor) || (state.cursor && this.compareCursors(event.cursor, state.cursor) <= 0))
				return;
			state.seenCursors.add(event.cursor);
			let processed = false;
			let attempt = 0;
			while (state.active) {
				try {
					if (!processed) {
						state.cursor = event.cursor;
						if (event.type === "message") await this.broadcastMessage(state, event);
						else {
							this.applyPatch(state, event);
							await this.broadcastAggregate(state, this.materializeAggregate(state));
						}
						processed = true;
					}
					if (!state.active) return;
					if (state.seenCursors.size > EnhancerApiService.MAX_SEEN_CURSORS) {
						const oldest = state.seenCursors.values().next().value;
						if (oldest) state.seenCursors.delete(oldest);
					}
					return;
				} catch (error) {
					attempt++;
					this.logger.error(`Failed to process Enhancer event for ${state.topic}:`, error);
					await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * 2 ** attempt, 30_000)));
				}
			}
			state.seenCursors.delete(event.cursor);
		});
	}

	private applyPatch(state: SubscriptionState, event: EnhancerAggregateUpdatedEvent): void {
		if (!state.aggregate) return;
		for (const account of event.accountsUpsert) state.aggregate.accounts.set(account.accountId, account);
		for (const id of event.accountIdsRemove) state.aggregate.accounts.delete(id);
		for (const badge of event.badgesUpsert) state.aggregate.badges.set(badge.badgeId, badge);
		for (const id of event.badgeIdsRemove) state.aggregate.badges.delete(id);
	}

	private handleSnapshot(event: EnhancerAggregateSnapshotEvent): void {
		const state = this.subscriptions.get(event.topic);
		if (!state?.active) return;
		if (!state.snapshot || state.snapshot.snapshotId !== event.snapshotId) {
			state.snapshot = { snapshotId: event.snapshotId, cursor: event.cursor, pages: new Map() };
		}
		if (state.snapshot.cursor !== event.cursor) return;
		state.snapshot.pages.set(event.page, event);
		if (!event.hasNextPage) state.snapshot.lastPage = event.page;
		if (this.isSnapshotComplete(state.snapshot) && !state.seedCollecting)
			void this.installSnapshot(state, state.snapshot);
	}

	private isSnapshotComplete(snapshot: NonNullable<SubscriptionState["snapshot"]>): boolean {
		if (snapshot.lastPage === undefined) return false;
		for (let page = 0; page <= snapshot.lastPage; page++) {
			if (!snapshot.pages.has(page)) return false;
		}
		return true;
	}

	private async installSnapshot(
		state: SubscriptionState,
		snapshot: NonNullable<SubscriptionState["snapshot"]>,
	): Promise<void> {
		await state.processing;
		if (state.snapshot !== snapshot) return;
		const accounts: AggregateMaps["accounts"] = new Map();
		const badges: AggregateMaps["badges"] = new Map();
		let channelId: string | null = null;
		let platform = state.platform.toUpperCase() as Uppercase<PlatformType>;
		for (let page = 0; page <= (snapshot.lastPage as number); page++) {
			const data = snapshot.pages.get(page) as EnhancerAggregateSnapshotEvent;
			channelId = data.channelId;
			platform = data.platform;
			for (const account of data.accounts) accounts.set(account.accountId, account);
			for (const badge of data.badges) badges.set(badge.badgeId, badge);
		}
		state.aggregate = { channelId, platform, accounts, badges };
		state.cursor = snapshot.cursor;
		state.snapshot = undefined;
		state.replaying = false;
		state.replayComplete = true;
		await this.broadcastAggregate(state, this.materializeAggregate(state));
		await this.flushBufferedEvents(state);
		this.resolveSynchronization(state);
	}

	private async finishReplay(state: SubscriptionState): Promise<void> {
		if (!state.replayComplete || state.seedCollecting || state.snapshot) return;
		state.replaying = false;
		await this.flushBufferedEvents(state);
		this.resolveSynchronization(state);
	}

	private async flushBufferedEvents(state: SubscriptionState): Promise<void> {
		const events = state.eventBuffer.sort((left, right) => this.compareCursors(left.cursor, right.cursor));
		state.eventBuffer = [];
		for (const event of events) {
			if (state.cursor && this.compareCursors(event.cursor, state.cursor) <= 0) continue;
			if (event.type === "channel.available") {
				this.applyChannelAvailable(event);
				continue;
			}
			if (event.type === "channel.unavailable") {
				await this.applyChannelUnavailable(state, event, Boolean(state.bootstrapPromise));
				continue;
			}
			const topic = event.type === "aggregate.updated" ? event.topic : this.getMessageTopic(event);
			if (topic === state.topic) this.processDataEvent(state, event);
		}
		await state.processing;
	}

	private handleChannelAvailable(event: EnhancerChannelAvailableEvent): void {
		const state = this.pendingSubscriptions.get(event.topic) ?? this.subscriptions.get(event.topic);
		if (!state?.active) return;
		if (
			state.replaying ||
			(state.seedCollecting && Boolean(state.aggregate)) ||
			state.snapshot ||
			state.transitioning
		) {
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
			.then((aggregate) => {
				if (aggregate) return this.broadcastAggregate(current, aggregate.aggregate);
			})
			.catch((error) => this.logger.error(`Failed to activate ${topic}:`, error));
	}

	private handleChannelUnavailable(event: EnhancerChannelUnavailableEvent): void {
		const state = this.subscriptions.get(event.topic);
		if (!state?.active) return;
		if (
			state.replaying ||
			(state.seedCollecting && Boolean(state.aggregate)) ||
			state.snapshot ||
			state.transitioning
		) {
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
			if (!state.replaying && !state.seedCollecting && !state.snapshot && state.eventBuffer.length > 0) {
				void this.flushBufferedEvents(state);
			}
		}
	}

	private async transitionChannelUnavailable(
		state: SubscriptionState,
		event: EnhancerChannelUnavailableEvent,
		deferBootstrap: boolean,
	): Promise<void> {
		await state.processing;
		if (state.cursor && this.compareCursors(event.cursor, state.cursor) <= 0) return;
		state.aggregate = null;
		state.cursor = event.cursor;
		await this.broadcastAggregate(state, null, event.replacementTopic);
		this.unsubscribe(state);
		state.confirmed = false;
		state.replaying = false;
		state.seenCursors.clear();

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
			const aggregate = this.materializeAggregate(replacement);
			if (aggregate) await this.broadcastAggregate(replacement, aggregate);
			return;
		}
		this.pendingSubscriptions.set(state.topic, state);
		if (deferBootstrap) {
			this.scheduleBootstrap(state);
			return;
		}
		const aggregate = await this.bootstrap(state);
		if (aggregate) await this.broadcastAggregate(state, aggregate.aggregate);
	}

	private scheduleBootstrap(state: SubscriptionState): void {
		void Promise.resolve().then(async () => {
			const running = state.bootstrapPromise;
			if (running) await running.catch(() => null);
			const current = this.resolveState(state);
			if (!current.active || current.aggregate !== undefined || current.rejected) return;
			try {
				const aggregate = await this.bootstrap(current);
				if (aggregate) await this.broadcastAggregate(current, aggregate.aggregate);
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
		if (this.pendingSubscription) {
			this.pendingSubscription.rejected = true;
			this.pendingSubscription.aggregate = null;
			this.pendingSubscriptions.set(this.pendingSubscription.topic, this.pendingSubscription);
			this.releaseSubscription(this.pendingSubscription);
		}
		this.pendingSubscription = null;
		this.sendNextSubscription();
	}

	private releaseSubscription(state: SubscriptionState): void {
		state.requested = false;
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
			!state.active ||
			!state.aggregate ||
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
		state.replaying = state.cursor !== undefined;
		state.replayComplete = false;
		state.eventBuffer = [];
		const command = {
			type: "subscribe",
			subscription: state.subscription,
			...(state.cursor !== undefined ? { after: state.cursor } : {}),
		};
		this.socket.send(JSON.stringify(command));
		this.scheduleConfirmationRetry(state);
	}

	private sendNextSubscription(): void {
		if (this.pendingSubscription) return;
		const next = [...this.subscriptions.values()]
			.filter(
				(state) =>
					state.active &&
					Boolean(state.aggregate) &&
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
		if (!state.replaying && !state.snapshot && !state.seedCollecting) return Promise.resolve();
		return new Promise((resolve) => state.syncWaiters.add(resolve));
	}

	private resolveSynchronization(state: SubscriptionState): void {
		for (const resolve of state.syncWaiters) resolve();
		state.syncWaiters.clear();
	}

	private async fetchAggregate(platform: PlatformType, externalId: string): Promise<EnhancerAggregateResponse | null> {
		const url = new URL(
			`/v1/channel/${platform}/${encodeURIComponent(externalId)}/aggregate`,
			EnhancerApiService.HTTP_BASE_URL,
		);
		const response = await fetch(url);
		if (response.status === 404) return null;
		if (!response.ok) {
			const body = (await response.json()) as EnhancerApiError;
			throw new Error(`${body.error?.code ?? response.status}: ${body.error?.message ?? response.statusText}`);
		}
		const body = (await response.json()) as EnhancerAggregateResponse;
		if (!Array.isArray(body.accounts) || !Array.isArray(body.badges) || typeof body.cursor !== "string") {
			throw new Error("Invalid Enhancer aggregate response");
		}
		return body;
	}

	private installAggregate(state: SubscriptionState, aggregate: EnhancerChannelDto, cursor: string): void {
		state.aggregate = {
			channelId: aggregate.channelId,
			platform: aggregate.platform,
			accounts: new Map(aggregate.accounts.map((account) => [account.accountId, account])),
			badges: new Map(aggregate.badges.map((badge) => [badge.badgeId, badge])),
		};
		state.cursor = cursor;
	}

	private installSeed(state: SubscriptionState, seed: CachedAggregateSeed): void {
		let current = this.resolveState(state);
		if (current.topic !== seed.topic) current = this.renameTopic(current, seed.topic);
		if (current.cursor && this.compareCursors(seed.cursor, current.cursor) <= 0) return;
		this.installAggregate(current, seed.aggregate, seed.cursor);
	}

	private materializeAggregate(state: SubscriptionState): EnhancerChannelDto | null {
		if (!state.aggregate) return null;
		return {
			channelId: state.aggregate.channelId,
			platform: state.aggregate.platform,
			accounts: [...state.aggregate.accounts.values()],
			badges: [...state.aggregate.badges.values()],
		};
	}

	private createSeed(state: SubscriptionState): CachedAggregateSeed | null {
		const aggregate = this.materializeAggregate(state);
		if (!aggregate || !state.cursor) return null;
		return { topic: state.topic, aggregate, cursor: state.cursor };
	}

	private async requestSeeds(topic: EnhancerAggregateTopic): Promise<CachedAggregateSeed[]> {
		const tabs = await chrome.tabs.query({ url: ["*://*.twitch.tv/*", "*://*.kick.com/*"] });
		const request: WorkerBroadcast = {
			type: "enhancer-api-seed-request",
			payload: { requestId: crypto.randomUUID(), topic },
		};
		const responses = await Promise.all(
			tabs.map(async (tab) => {
				if (tab.id === undefined) return null;
				try {
					return (await chrome.tabs.sendMessage(tab.id, request, { frameId: 0 })) as CachedAggregateSeed | null;
				} catch {
					return null;
				}
			}),
		);
		return responses.filter((seed): seed is CachedAggregateSeed => seed?.topic === topic);
	}

	private async broadcastAggregate(
		state: SubscriptionState,
		aggregate: EnhancerChannelDto | null,
		replacementTopic?: EnhancerAggregateTopic,
	): Promise<void> {
		if (!state.cursor) return;
		await this.broadcastToSubscribers(state, (client) => ({
			type: "enhancer-api-updated",
			payload: {
				platform: state.platform,
				clientId: client.clientId,
				scope: state.scope,
				topic: state.topic,
				aggregate,
				cursor: state.cursor as string,
				replacementTopic,
			},
		}));
	}

	private async broadcastMessage(state: SubscriptionState, message: EnhancerMessageEvent): Promise<void> {
		await this.broadcastToSubscribers(state, (client) => ({
			type: "enhancer-api-message",
			payload: { platform: state.platform, clientId: client.clientId, topic: state.topic, message },
		}));
	}

	private async broadcastToSubscribers(
		state: SubscriptionState,
		createMessage: (client: EnhancerApiClient) => WorkerBroadcast,
	): Promise<void> {
		const staleClients: Array<{ clientId: string; generation: number }> = [];
		await Promise.all(
			[...state.subscribers].map(async (clientId) => {
				const client = this.clients.get(clientId);
				if (!client) return;
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
			state.replaying = false;
			state.replayComplete = false;
			state.snapshot = undefined;
			state.eventBuffer = [];
			if (state.confirmationRetry) clearTimeout(state.confirmationRetry);
			state.confirmationRetry = null;
		}
	}
}
