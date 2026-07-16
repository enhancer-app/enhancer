import type { Logger } from "$shared/logger/logger.ts";
import type {
	EnhancerAggregatePage,
	EnhancerApiError,
	EnhancerChannelDto,
	EnhancerMessageEvent,
	EnhancerStateEvent,
	EnhancerStreamerWatchTimeData,
	EnhancerSubscription,
	EnhancerWebSocketMessage,
} from "$types/apis/enhancer.apis.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type {
	AggregateScope,
	CachedPage,
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
	private readonly subscriptions = new Map<string, SubscriptionState>();
	private readonly pageCache = new Map<string, CachedPage>();
	private socket: WebSocket | null = null;
	private serverReady = false;
	private connectionPromise: Promise<void> | null = null;
	private heartbeat: ReturnType<typeof setInterval> | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private reconnectAttempt = 0;
	private clientGeneration = 0;
	private pendingSubscription: SubscriptionState | null = null;

	constructor(private readonly logger: Logger) {
		chrome.tabs.onRemoved.addListener((tabId) => this.removeTabClients(tabId));
	}

	async initialize(
		tabId: number,
		frameId: number,
		clientId: string,
		platform: PlatformType,
	): Promise<EnhancerChannelDto> {
		const client = this.registerClient(tabId, frameId, clientId, platform);
		const state = this.subscribeClient(client, "GLOBAL");
		const aggregate = await this.subscribeAndFetch(state);
		if (!aggregate) throw new Error(`Global ${platform} aggregate was not found`);
		return aggregate;
	}

	async joinChannel(
		tabId: number,
		frameId: number,
		clientId: string,
		platform: PlatformType,
		externalId: string,
	): Promise<EnhancerChannelDto | null> {
		if (!externalId) throw new Error("Channel external ID is required");
		const client = this.registerClient(tabId, frameId, clientId, platform);
		const topic = this.getTopic(platform, "CHANNEL", externalId);
		if (client.channelTopic && client.channelTopic !== topic) this.unsubscribeClient(client, client.channelTopic);
		const state = this.subscribeClient(client, "CHANNEL", externalId);
		client.channelTopic = topic;
		return this.subscribeAndFetch(state);
	}

	async getWatchTime(username: string): Promise<EnhancerStreamerWatchTimeData[]> {
		if (!username) throw new Error("Username is required");
		const response = await fetch(`https://xayo.pl/api/chatters/${encodeURIComponent(username)}/watchtime`, {
			headers: { Accept: "application/json" },
		});
		if (!response.ok) throw new Error(`Watchtime request failed with status ${response.status}`);
		return response.json() as Promise<EnhancerStreamerWatchTimeData[]>;
	}

	disconnect(
		_tabId: number,
		_frameId: number,
		clientId: string,
		_platform: PlatformType,
		preserveCursor = false,
	): void {
		this.unregisterClient(clientId, preserveCursor);
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
			if (this.subscriptions.size >= EnhancerApiService.MAX_SUBSCRIPTIONS) {
				throw new Error("Enhancer WebSocket subscription limit reached");
			}
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
				cursorLoaded: false,
				replaying: false,
				recovering: false,
				replayBuffer: [],
				confirmationRetry: null,
				dirty: false,
				broadcastRequested: false,
				confirmationWaiters: new Set(),
				seenCursors: new Set(),
				processing: Promise.resolve(),
			};
			this.subscriptions.set(topic, state);
		}
		state.active = true;
		state.subscribers.add(client.clientId);
		client.topics.add(topic);
		return state;
	}

	private unsubscribeClient(client: EnhancerApiClient, topic: string, preserveCursor = false): void {
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
		this.subscriptions.delete(topic);
		if (!preserveCursor) void this.clearCursor(state);
		if (this.subscriptions.size === 0) this.closeConnection();
	}

	private unregisterClient(clientId: string, preserveCursor = false): void {
		const client = this.clients.get(clientId);
		if (!client) return;
		for (const topic of [...client.topics]) this.unsubscribeClient(client, topic, preserveCursor);
		this.clients.delete(clientId);
	}

	private removeTabClients(tabId: number): void {
		for (const client of [...this.clients.values()]) {
			if (client.tabId === tabId) this.unregisterClient(client.clientId);
		}
	}

	private getTopic(platform: PlatformType, scope: AggregateScope, externalId?: string): string {
		const suffix = scope === "CHANNEL" ? `:${externalId?.toLowerCase()}` : "";
		return `${scope.toLowerCase()}:${platform.toUpperCase()}${suffix}`;
	}

	private async subscribeAndFetch(state: SubscriptionState): Promise<EnhancerChannelDto | null> {
		await this.restoreCursor(state);
		try {
			await this.ensureConnection();
			if (!state.active) return null;
			if (!state.confirmed) {
				this.sendSubscription(state);
				await this.waitForConfirmation(state);
			}
		} catch (error) {
			this.logger.warn(`Enhancer WebSocket unavailable for ${state.topic}:`, error);
		}
		if (!state.active) return null;
		if (state.refreshPromise) return state.refreshPromise;
		if (state.aggregate !== undefined) return state.aggregate;
		return this.refreshAggregate(state, false);
	}

	private ensureConnection(): Promise<void> {
		if (this.serverReady && this.socket?.readyState === WebSocket.OPEN) return Promise.resolve();
		if (this.connectionPromise) return this.connectionPromise;
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		this.connectionPromise = new Promise<void>((resolve, reject) => {
			const socket = new WebSocket(EnhancerApiService.WEBSOCKET_URL);
			this.socket = socket;
			let settled = false;
			const timeout = setTimeout(() => {
				if (settled) return;
				settled = true;
				socket.close();
				reject(new Error("Enhancer WebSocket readiness timed out"));
			}, EnhancerApiService.CONFIRMATION_TIMEOUT_MS);

			socket.addEventListener("message", (event) => {
				if (this.socket !== socket) return;
				if (typeof event.data !== "string") return;
				let message: EnhancerWebSocketMessage;
				try {
					message = JSON.parse(event.data) as EnhancerWebSocketMessage;
				} catch (error) {
					this.logger.warn("Invalid Enhancer WebSocket message:", error);
					return;
				}
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
			this.releasePendingSubscription();
			return;
		}

		if (message.type === "subscription.confirmed") {
			const state = this.subscriptions.get(message.topic) ?? this.pendingSubscription ?? undefined;
			if (!state) return;
			if (state.topic !== message.topic) this.renameTopic(state, message.topic);
			state.confirmed = true;
			state.rejected = false;
			if (this.pendingSubscription === state) this.pendingSubscription = null;
			if (state.confirmationRetry) clearTimeout(state.confirmationRetry);
			state.confirmationRetry = null;
			for (const resolve of state.confirmationWaiters) resolve();
			state.confirmationWaiters.clear();
			this.sendNextSubscription();
			void this.refreshAggregate(state, true).catch((error) =>
				this.logger.error(`Failed to refresh ${message.topic}:`, error),
			);
			return;
		}

		if (message.type === "replay.complete") {
			const state = this.subscriptions.get(message.topic);
			if (!state) return;
			const events = state.replayBuffer.sort((left, right) => this.compareCursors(left.cursor, right.cursor));
			state.replayBuffer = [];
			state.replaying = false;
			for (const event of events) this.processDataEvent(state, event);
			return;
		}

		if (message.type === "sync.required" && "topic" in message) {
			const state = this.subscriptions.get(message.topic);
			if (state) void this.recoverSubscription(state);
			return;
		}

		if (message.type === "message") {
			this.handleDataEvent(message);
			return;
		}

		if (
			message.type === "badge.updated" ||
			message.type === "badge-assignment.updated" ||
			message.type === "appearance.updated" ||
			(message.type === "sync.required" && "topics" in message)
		) {
			this.handleDataEvent(message);
			return;
		}

		if (message.type === "error") {
			this.logger.warn(`Enhancer WebSocket protocol error: ${message.code}`);
			this.releasePendingSubscription();
		}
	}

	private renameTopic(state: SubscriptionState, topic: string): void {
		const previousTopic = state.topic;
		this.subscriptions.delete(previousTopic);
		state.topic = topic;
		this.subscriptions.set(topic, state);
		for (const clientId of state.subscribers) {
			const client = this.clients.get(clientId);
			if (!client) continue;
			client.topics.delete(previousTopic);
			client.topics.add(topic);
			if (client.channelTopic === previousTopic) client.channelTopic = topic;
		}
	}

	private handleDataEvent(event: EnhancerMessageEvent | EnhancerStateEvent): void {
		for (const topic of this.getEventTopics(event)) {
			const state = this.subscriptions.get(topic);
			if (!state) continue;
			if (state.replaying) state.replayBuffer.push(event);
			else this.processDataEvent(state, event);
		}
	}

	private processDataEvent(state: SubscriptionState, event: EnhancerMessageEvent | EnhancerStateEvent): void {
		state.processing = state.processing.then(async () => {
			if (state.seenCursors.has(event.cursor)) return;
			state.seenCursors.add(event.cursor);
			let processed = false;
			let attempt = 0;
			while (state.active) {
				try {
					if (!processed) {
						if (event.type === "message") await this.broadcastMessage(state, event);
						else await this.refreshAggregate(state, true);
						processed = true;
					}
					if (!state.active) return;
					await this.commitCursor(state, event.cursor);
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

	private async recoverSubscription(state: SubscriptionState): Promise<void> {
		if (state.recovering) return;
		state.recovering = true;
		state.replaying = true;
		state.cursor = undefined;
		state.seenCursors.clear();
		let attempt = 0;
		while (state.active) {
			try {
				await this.clearCursor(state);
				await this.refreshAggregate(state, true);
				break;
			} catch (error) {
				attempt++;
				this.logger.error(`Failed to resync ${state.topic}:`, error);
				await new Promise((resolve) => setTimeout(resolve, Math.min(1000 * 2 ** attempt, 30_000)));
			}
		}
		const events = state.replayBuffer.sort((left, right) => this.compareCursors(left.cursor, right.cursor));
		state.replayBuffer = [];
		state.replaying = false;
		state.recovering = false;
		for (const event of events) this.processDataEvent(state, event);
	}

	private getEventTopics(event: EnhancerMessageEvent | EnhancerStateEvent): string[] {
		if (event.type === "sync.required") return event.topics;
		if (event.type === "message") {
			const { target } = event;
			const suffix = "externalId" in target ? `:${target.externalId.toLowerCase()}` : "";
			return [`${target.scope.toLowerCase()}:${target.platform}${suffix}`];
		}
		const scope = event.channelExternalId ? "channel" : "global";
		const suffix = event.channelExternalId ? `:${event.channelExternalId.toLowerCase()}` : "";
		return [`${scope}:${event.platform}${suffix}`];
	}

	private releasePendingSubscription(): void {
		if (this.pendingSubscription) {
			this.pendingSubscription.rejected = true;
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
	}

	private sendSubscription(state: SubscriptionState): void {
		if (
			state.requested ||
			state.rejected ||
			!state.active ||
			!this.serverReady ||
			this.socket?.readyState !== WebSocket.OPEN
		) {
			return;
		}
		if (this.pendingSubscription && this.pendingSubscription !== state) return;
		this.pendingSubscription = state;
		state.requested = true;
		state.replaying = Boolean(state.cursor);
		state.replayBuffer = [];
		this.socket.send(
			JSON.stringify({
				type: "subscribe",
				subscription: state.subscription,
				...(state.cursor ? { after: state.cursor } : {}),
			}),
		);
		this.scheduleConfirmationRetry(state);
	}

	private sendNextSubscription(): void {
		if (this.pendingSubscription) return;
		const next = [...this.subscriptions.values()].find((state) => state.active && !state.confirmed && !state.rejected);
		if (next) this.sendSubscription(next);
	}

	private unsubscribe(state: SubscriptionState): void {
		if (this.serverReady && this.socket?.readyState === WebSocket.OPEN) {
			this.socket.send(JSON.stringify({ type: "unsubscribe", subscription: state.subscription }));
		}
		state.requested = false;
		if (this.pendingSubscription === state) this.pendingSubscription = null;
		if (state.confirmationRetry) clearTimeout(state.confirmationRetry);
		state.confirmationRetry = null;
		this.sendNextSubscription();
	}

	private scheduleConfirmationRetry(state: SubscriptionState): void {
		if (state.confirmationRetry) clearTimeout(state.confirmationRetry);
		state.confirmationRetry = setTimeout(() => {
			state.confirmationRetry = null;
			if (!state.active || state.confirmed || !this.serverReady) return;
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

	private refreshAggregate(state: SubscriptionState, broadcast: boolean): Promise<EnhancerChannelDto | null> {
		state.broadcastRequested ||= broadcast;
		if (state.refreshPromise) {
			state.dirty = true;
			return state.refreshPromise;
		}

		state.refreshPromise = (async () => {
			let aggregate: EnhancerChannelDto | null = null;
			do {
				state.dirty = false;
				aggregate = await this.fetchAggregate(
					state.platform,
					state.scope === "GLOBAL" ? "global" : (state.externalId as string),
				);
				state.aggregate = aggregate;
				if (state.broadcastRequested) {
					state.broadcastRequested = false;
					await this.broadcastAggregate(state, aggregate);
				}
			} while (state.dirty);
			return aggregate;
		})().finally(() => {
			state.refreshPromise = undefined;
		});

		return state.refreshPromise;
	}

	private async fetchAggregate(platform: PlatformType, externalId: string): Promise<EnhancerChannelDto | null> {
		const accounts = new Map<string, EnhancerAggregatePage["accounts"][number]>();
		const badges = new Map<string, EnhancerAggregatePage["badges"][number]>();
		let channelId: string | null = null;
		let responsePlatform = platform.toUpperCase() as Uppercase<PlatformType>;

		for (let page = 0; ; page++) {
			const url = new URL(
				`/v1/channel/${platform}/${encodeURIComponent(externalId)}/aggregate`,
				EnhancerApiService.HTTP_BASE_URL,
			);
			url.searchParams.set("page", page.toString());
			const cached = this.pageCache.get(url.href);
			const response = await fetch(url, {
				headers: cached ? { "If-None-Match": cached.etag } : undefined,
			});
			if (response.status === 404) return null;
			if (!response.ok && response.status !== 304) {
				const body = (await response.json()) as EnhancerApiError;
				throw new Error(`${body.error?.code ?? response.status}: ${body.error?.message ?? response.statusText}`);
			}

			const body = response.status === 304 ? cached?.body : ((await response.json()) as EnhancerAggregatePage);
			if (!body || !Array.isArray(body.accounts) || !Array.isArray(body.badges) || body.page !== page) {
				throw new Error("Invalid Enhancer aggregate response");
			}
			const etag = response.headers.get("ETag");
			if (response.status === 200 && etag) this.pageCache.set(url.href, { etag, body });
			channelId = body.channelId;
			responsePlatform = body.platform;
			for (const account of body.accounts) accounts.set(account.accountId, account);
			for (const badge of body.badges) badges.set(badge.badgeId, badge);
			if (!body.hasNextPage) break;
		}

		return {
			channelId,
			platform: responsePlatform,
			accounts: [...accounts.values()],
			badges: [...badges.values()],
		};
	}

	private async broadcastAggregate(state: SubscriptionState, aggregate: EnhancerChannelDto | null): Promise<void> {
		await this.broadcastToSubscribers(state, (client) => ({
			type: "enhancer-api-updated",
			payload: {
				platform: state.platform,
				clientId: client.clientId,
				scope: state.scope,
				externalId: state.externalId,
				aggregate,
			},
		}));
	}

	private async broadcastMessage(state: SubscriptionState, message: EnhancerMessageEvent): Promise<void> {
		await this.broadcastToSubscribers(state, (client) => ({
			type: "enhancer-api-message",
			payload: { platform: state.platform, clientId: client.clientId, message },
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
				if (!client) {
					return;
				}
				const generation = client.generation;
				try {
					await chrome.tabs.sendMessage(client.tabId, createMessage(client), { frameId: client.frameId });
				} catch {
					staleClients.push({ clientId, generation });
				}
			}),
		);
		for (const stale of staleClients) {
			if (this.clients.get(stale.clientId)?.generation === stale.generation) {
				this.unregisterClient(stale.clientId, true);
			}
		}
	}

	private async commitCursor(state: SubscriptionState, cursor: string): Promise<void> {
		await chrome.storage.session.set({ [this.getCursorKey(state)]: cursor });
		if (!state.cursor || this.compareCursors(cursor, state.cursor) > 0) state.cursor = cursor;
		if (state.seenCursors.size > EnhancerApiService.MAX_SEEN_CURSORS) {
			const oldest = state.seenCursors.values().next().value;
			if (oldest) state.seenCursors.delete(oldest);
		}
	}

	private async restoreCursor(state: SubscriptionState): Promise<void> {
		if (state.cursorLoaded) return;
		if (!state.cursorLoadPromise) {
			state.cursorLoadPromise = (async () => {
				try {
					const key = this.getCursorKey(state);
					const stored = await chrome.storage.session.get(key);
					if (typeof stored[key] === "string") state.cursor = stored[key];
				} catch (error) {
					this.logger.warn(`Failed to restore Enhancer cursor for ${state.topic}:`, error);
				} finally {
					state.cursorLoaded = true;
				}
			})();
		}
		await state.cursorLoadPromise;
	}

	private async clearCursor(state: SubscriptionState): Promise<void> {
		await chrome.storage.session.remove(this.getCursorKey(state));
	}

	private getCursorKey(state: SubscriptionState): string {
		return `enhancer-api:topic:${state.topic}`;
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
		for (const state of this.subscriptions.values()) {
			state.confirmed = false;
			state.rejected = false;
			state.requested = false;
			state.replaying = false;
			state.replayBuffer = [];
			if (state.confirmationRetry) clearTimeout(state.confirmationRetry);
			state.confirmationRetry = null;
		}
	}
}
