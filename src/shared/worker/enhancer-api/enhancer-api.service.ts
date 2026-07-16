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
import type { WorkerBroadcast } from "$types/shared/worker/worker.types.ts";

type AggregateScope = "GLOBAL" | "CHANNEL";

interface CachedPage {
	etag: string;
	body: EnhancerAggregatePage;
}

interface SubscriptionState {
	scope: AggregateScope;
	externalId?: string;
	subscription: EnhancerSubscription;
	topic?: string;
	confirmed: boolean;
	requested: boolean;
	active: boolean;
	aggregate?: EnhancerChannelDto | null;
	cursor?: string;
	cursorLoaded: boolean;
	replaying: boolean;
	recovering: boolean;
	replayBuffer: Array<EnhancerMessageEvent | EnhancerStateEvent>;
	confirmationRetry: ReturnType<typeof setTimeout> | null;
	dirty: boolean;
	broadcastRequested: boolean;
	refreshPromise?: Promise<EnhancerChannelDto | null>;
	confirmationWaiters: Set<() => void>;
	seenCursors: Set<string>;
	processing: Promise<void>;
}

interface EnhancerApiSession {
	tabId: number;
	frameId: number;
	clientId: string;
	platform: PlatformType;
	socket: WebSocket | null;
	serverReady: boolean;
	connectionPromise: Promise<void> | null;
	heartbeat: ReturnType<typeof setInterval> | null;
	reconnectTimer: ReturnType<typeof setTimeout> | null;
	reconnectAttempt: number;
	subscriptions: Map<AggregateScope, SubscriptionState>;
	pageCache: Map<string, CachedPage>;
	disposed: boolean;
}

export class EnhancerApiService {
	private static readonly HTTP_BASE_URL = "https://api.enhancer.at";
	private static readonly WEBSOCKET_URL = "wss://api.enhancer.at/v1/ws";
	private static readonly CONFIRMATION_TIMEOUT_MS = 5000;
	private static readonly HEARTBEAT_INTERVAL_MS = 25_000;
	private static readonly MAX_SEEN_CURSORS = 1000;

	private readonly sessions = new Map<string, EnhancerApiSession>();

	constructor(private readonly logger: Logger) {
		chrome.tabs.onRemoved.addListener((tabId) => this.closeTabSessions(tabId));
	}

	async initialize(
		tabId: number,
		frameId: number,
		clientId: string,
		platform: PlatformType,
	): Promise<EnhancerChannelDto> {
		const session = this.getSession(tabId, frameId, clientId, platform);
		const state = this.getOrCreateSubscription(session, "GLOBAL");
		const aggregate = await this.subscribeAndFetch(session, state);
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
		const session = this.getSession(tabId, frameId, clientId, platform);
		const current = session.subscriptions.get("CHANNEL");
		if (current?.externalId !== externalId) {
			if (current) {
				current.active = false;
				this.releaseSubscription(current);
				this.unsubscribe(session, current);
			}
			session.subscriptions.delete("CHANNEL");
		}
		const state = this.getOrCreateSubscription(session, "CHANNEL", externalId);
		return this.subscribeAndFetch(session, state);
	}

	async getWatchTime(username: string): Promise<EnhancerStreamerWatchTimeData[]> {
		if (!username) throw new Error("Username is required");
		const response = await fetch(`https://xayo.pl/api/chatters/${encodeURIComponent(username)}/watchtime`, {
			headers: { Accept: "application/json" },
		});
		if (!response.ok) throw new Error(`Watchtime request failed with status ${response.status}`);
		return response.json() as Promise<EnhancerStreamerWatchTimeData[]>;
	}

	disconnect(tabId: number, frameId: number, clientId: string, platform: PlatformType): void {
		const key = `${tabId}:${frameId}:${clientId}:${platform}`;
		const session = this.sessions.get(key);
		if (!session) return;
		this.closeSession(session);
		this.sessions.delete(key);
	}

	private getSession(tabId: number, frameId: number, clientId: string, platform: PlatformType): EnhancerApiSession {
		const key = `${tabId}:${frameId}:${clientId}:${platform}`;
		let session = this.sessions.get(key);
		if (session) return session;
		for (const [existingKey, existing] of this.sessions) {
			if (existing.tabId !== tabId || existing.frameId !== frameId || existing.platform !== platform) continue;
			this.closeSession(existing);
			this.sessions.delete(existingKey);
		}
		session = {
			tabId,
			frameId,
			clientId,
			platform,
			socket: null,
			serverReady: false,
			connectionPromise: null,
			heartbeat: null,
			reconnectTimer: null,
			reconnectAttempt: 0,
			subscriptions: new Map(),
			pageCache: new Map(),
			disposed: false,
		};
		this.sessions.set(key, session);
		return session;
	}

	private getOrCreateSubscription(
		session: EnhancerApiSession,
		scope: AggregateScope,
		externalId?: string,
	): SubscriptionState {
		const existing = session.subscriptions.get(scope);
		if (existing) return existing;
		const platform = session.platform.toUpperCase() as Uppercase<PlatformType>;
		const subscription: EnhancerSubscription =
			scope === "GLOBAL" ? { scope, platform } : { scope, platform, externalId: externalId as string };
		const state: SubscriptionState = {
			scope,
			externalId,
			subscription,
			confirmed: false,
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
		session.subscriptions.set(scope, state);
		return state;
	}

	private async subscribeAndFetch(
		session: EnhancerApiSession,
		state: SubscriptionState,
	): Promise<EnhancerChannelDto | null> {
		await this.restoreCursor(session, state);
		try {
			await this.ensureConnection(session);
			if (!state.active) return null;
			if (!state.confirmed) {
				this.sendSubscription(session, state);
				await this.waitForConfirmation(state);
			}
		} catch (error) {
			this.logger.warn(`Enhancer WebSocket unavailable for tab ${session.tabId}:`, error);
		}
		if (!state.active) return null;
		return state.refreshPromise ?? this.refreshAggregate(session, state, false);
	}

	private ensureConnection(session: EnhancerApiSession): Promise<void> {
		if (session.serverReady && session.socket?.readyState === WebSocket.OPEN) return Promise.resolve();
		if (session.connectionPromise) return session.connectionPromise;
		if (session.reconnectTimer) {
			clearTimeout(session.reconnectTimer);
			session.reconnectTimer = null;
		}

		session.connectionPromise = new Promise<void>((resolve, reject) => {
			const socket = new WebSocket(EnhancerApiService.WEBSOCKET_URL);
			session.socket = socket;
			let settled = false;
			const timeout = setTimeout(() => {
				if (settled) return;
				settled = true;
				socket.close();
				reject(new Error("Enhancer WebSocket readiness timed out"));
			}, EnhancerApiService.CONFIRMATION_TIMEOUT_MS);

			socket.addEventListener("message", (event) => {
				if (typeof event.data !== "string") return;
				let message: EnhancerWebSocketMessage;
				try {
					message = JSON.parse(event.data) as EnhancerWebSocketMessage;
				} catch (error) {
					this.logger.warn("Invalid Enhancer WebSocket message:", error);
					return;
				}
				if ("type" in message && message.type === "connection.ready") {
					session.serverReady = true;
					session.reconnectAttempt = 0;
					this.startHeartbeat(session);
					for (const state of session.subscriptions.values()) this.sendSubscription(session, state);
					if (!settled) {
						settled = true;
						clearTimeout(timeout);
						resolve();
					}
					return;
				}
				this.handleSocketMessage(session, message);
			});

			socket.addEventListener("close", () => {
				clearTimeout(timeout);
				if (!settled) {
					settled = true;
					reject(new Error("Enhancer WebSocket closed before it was ready"));
				}
				this.handleSocketClose(session);
			});

			socket.addEventListener("error", () => {
				this.logger.warn(`Enhancer WebSocket error for tab ${session.tabId}`);
			});
		}).finally(() => {
			session.connectionPromise = null;
		});

		return session.connectionPromise;
	}

	private handleSocketMessage(session: EnhancerApiSession, message: EnhancerWebSocketMessage): void {
		if (!("type" in message)) {
			this.logger.warn(`Enhancer WebSocket error: ${message.error.code}: ${message.error.message}`);
			if (message.error.code === "NOT_FOUND") this.releaseUnconfirmedSubscriptions(session);
			return;
		}

		if (message.type === "subscription.confirmed") {
			const state = this.findSubscriptionByTopic(session, message.topic);
			if (!state) return;
			state.topic = message.topic;
			state.confirmed = true;
			if (state.confirmationRetry) clearTimeout(state.confirmationRetry);
			state.confirmationRetry = null;
			for (const resolve of state.confirmationWaiters) resolve();
			state.confirmationWaiters.clear();
			void this.refreshAggregate(session, state, true).catch((error) =>
				this.logger.error(`Failed to refresh ${message.topic}:`, error),
			);
			return;
		}

		if (message.type === "replay.complete") {
			const state = this.findSubscriptionByTopic(session, message.topic);
			if (!state) return;
			const events = state.replayBuffer.sort((left, right) => this.compareCursors(left.cursor, right.cursor));
			state.replayBuffer = [];
			state.replaying = false;
			for (const event of events) this.processDataEvent(session, state, event);
			return;
		}

		if (message.type === "sync.required" && "topic" in message) {
			const state = this.findSubscriptionByTopic(session, message.topic);
			if (state) void this.recoverSubscription(session, state);
			return;
		}

		if (message.type === "message") {
			this.handleDataEvent(session, message);
			return;
		}

		if (
			message.type === "badge.updated" ||
			message.type === "badge-assignment.updated" ||
			message.type === "appearance.updated" ||
			(message.type === "sync.required" && "topics" in message)
		) {
			this.handleDataEvent(session, message);
			return;
		}

		if (message.type === "error") {
			this.logger.warn(`Enhancer WebSocket protocol error: ${message.code}`);
			this.releaseUnconfirmedSubscriptions(session);
		}
	}

	private handleDataEvent(session: EnhancerApiSession, event: EnhancerMessageEvent | EnhancerStateEvent): void {
		const topics = this.getEventTopics(event);
		for (const topic of topics) {
			const state = this.findSubscriptionByTopic(session, topic);
			if (!state) continue;
			if (state.replaying) state.replayBuffer.push(event);
			else this.processDataEvent(session, state, event);
		}
	}

	private processDataEvent(
		session: EnhancerApiSession,
		state: SubscriptionState,
		event: EnhancerMessageEvent | EnhancerStateEvent,
	): void {
		state.processing = state.processing.then(async () => {
			if (this.hasSeenCursor(state, event.cursor)) return;
			state.seenCursors.add(event.cursor);
			let processed = false;
			let attempt = 0;
			while (state.active) {
				try {
					if (!processed) {
						if (event.type === "message") {
							await this.broadcast(session, {
								type: "enhancer-api-message",
								payload: { platform: session.platform, clientId: session.clientId, message: event },
							});
						} else {
							await this.refreshAggregate(session, state, true);
						}
						processed = true;
					}
					await this.commitCursor(session, state, event.cursor);
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

	private async recoverSubscription(session: EnhancerApiSession, state: SubscriptionState): Promise<void> {
		if (state.recovering) return;
		state.recovering = true;
		state.replaying = true;
		state.cursor = undefined;
		state.seenCursors.clear();
		let attempt = 0;
		while (state.active) {
			try {
				await this.clearCursor(session, state);
				await this.refreshAggregate(session, state, true);
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
		for (const event of events) this.processDataEvent(session, state, event);
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

	private findSubscriptionByTopic(session: EnhancerApiSession, topic: string): SubscriptionState | undefined {
		for (const state of session.subscriptions.values()) {
			if (state.topic === topic) return state;
			if (state.scope === "GLOBAL" && topic === `global:${session.platform.toUpperCase()}`) return state;
			if (
				!state.topic &&
				state.scope === "CHANNEL" &&
				topic === `channel:${session.platform.toUpperCase()}:${state.externalId?.toLowerCase()}`
			) {
				return state;
			}
		}
		return undefined;
	}

	private releaseUnconfirmedSubscriptions(session: EnhancerApiSession): void {
		for (const state of session.subscriptions.values()) {
			if (state.confirmed) continue;
			this.releaseSubscription(state);
		}
	}

	private releaseSubscription(state: SubscriptionState): void {
		state.requested = false;
		if (state.confirmationRetry) clearTimeout(state.confirmationRetry);
		state.confirmationRetry = null;
		for (const resolve of state.confirmationWaiters) resolve();
		state.confirmationWaiters.clear();
	}

	private sendSubscription(session: EnhancerApiSession, state: SubscriptionState): void {
		if (state.requested || !session.serverReady || session.socket?.readyState !== WebSocket.OPEN) return;
		state.requested = true;
		state.replaying = Boolean(state.cursor);
		state.replayBuffer = [];
		session.socket.send(
			JSON.stringify({
				type: "subscribe",
				subscription: state.subscription,
				...(state.cursor ? { after: state.cursor } : {}),
			}),
		);
		this.scheduleConfirmationRetry(session, state);
	}

	private unsubscribe(session: EnhancerApiSession, state: SubscriptionState): void {
		if (session.serverReady && session.socket?.readyState === WebSocket.OPEN) {
			session.socket.send(JSON.stringify({ type: "unsubscribe", subscription: state.subscription }));
		}
		state.requested = false;
		if (state.confirmationRetry) clearTimeout(state.confirmationRetry);
		state.confirmationRetry = null;
	}

	private scheduleConfirmationRetry(session: EnhancerApiSession, state: SubscriptionState): void {
		if (state.confirmationRetry) clearTimeout(state.confirmationRetry);
		state.confirmationRetry = setTimeout(() => {
			state.confirmationRetry = null;
			if (!state.active || state.confirmed || !session.serverReady) return;
			state.requested = false;
			this.sendSubscription(session, state);
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

	private refreshAggregate(
		session: EnhancerApiSession,
		state: SubscriptionState,
		broadcast: boolean,
	): Promise<EnhancerChannelDto | null> {
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
					session,
					state.scope === "GLOBAL" ? "global" : (state.externalId as string),
				);
				state.aggregate = aggregate;
				if (state.broadcastRequested) {
					state.broadcastRequested = false;
					await this.broadcast(session, {
						type: "enhancer-api-updated",
						payload: {
							platform: session.platform,
							clientId: session.clientId,
							scope: state.scope,
							externalId: state.externalId,
							aggregate,
						},
					});
				}
			} while (state.dirty);
			return aggregate;
		})().finally(() => {
			state.refreshPromise = undefined;
		});

		return state.refreshPromise;
	}

	private async fetchAggregate(session: EnhancerApiSession, externalId: string): Promise<EnhancerChannelDto | null> {
		const accounts = new Map<string, EnhancerAggregatePage["accounts"][number]>();
		const badges = new Map<string, EnhancerAggregatePage["badges"][number]>();
		let channelId: string | null = null;
		let responsePlatform = session.platform.toUpperCase() as Uppercase<PlatformType>;

		for (let page = 0; ; page++) {
			const url = new URL(
				`/v1/channel/${session.platform}/${encodeURIComponent(externalId)}/aggregate`,
				EnhancerApiService.HTTP_BASE_URL,
			);
			url.searchParams.set("page", page.toString());
			const cached = session.pageCache.get(url.href);
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
			if (response.status === 200 && etag) session.pageCache.set(url.href, { etag, body });
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

	private hasSeenCursor(state: SubscriptionState, cursor: string): boolean {
		return state.seenCursors.has(cursor);
	}

	private async commitCursor(session: EnhancerApiSession, state: SubscriptionState, cursor: string): Promise<void> {
		await chrome.storage.session.set({ [this.getCursorKey(session, state)]: cursor });
		if (!state.cursor || this.compareCursors(cursor, state.cursor) > 0) state.cursor = cursor;
		if (state.seenCursors.size > EnhancerApiService.MAX_SEEN_CURSORS) {
			const oldest = state.seenCursors.values().next().value;
			if (oldest) state.seenCursors.delete(oldest);
		}
	}

	private async restoreCursor(session: EnhancerApiSession, state: SubscriptionState): Promise<void> {
		if (state.cursorLoaded) return;
		state.cursorLoaded = true;
		try {
			const key = this.getCursorKey(session, state);
			const stored = await chrome.storage.session.get(key);
			if (typeof stored[key] === "string") state.cursor = stored[key];
		} catch (error) {
			this.logger.warn(`Failed to restore Enhancer cursor for ${state.scope}:`, error);
		}
	}

	private async clearCursor(session: EnhancerApiSession, state: SubscriptionState): Promise<void> {
		await chrome.storage.session.remove(this.getCursorKey(session, state));
	}

	private getCursorKey(session: EnhancerApiSession, state: SubscriptionState): string {
		return `enhancer-api:${session.clientId}:${session.platform}:${state.scope}:${state.externalId ?? "global"}`;
	}

	private compareCursors(left: string, right: string): number {
		const [leftMs, leftSequence] = left.split("-").map(BigInt);
		const [rightMs, rightSequence] = right.split("-").map(BigInt);
		if (leftMs !== rightMs) return leftMs > rightMs ? 1 : -1;
		if (leftSequence === rightSequence) return 0;
		return leftSequence > rightSequence ? 1 : -1;
	}

	private startHeartbeat(session: EnhancerApiSession): void {
		if (session.heartbeat) clearInterval(session.heartbeat);
		session.heartbeat = setInterval(() => {
			if (session.socket?.readyState === WebSocket.OPEN) {
				session.socket.send(JSON.stringify({ type: "ping" }));
			}
		}, EnhancerApiService.HEARTBEAT_INTERVAL_MS);
	}

	private handleSocketClose(session: EnhancerApiSession): void {
		session.serverReady = false;
		session.socket = null;
		if (session.heartbeat) clearInterval(session.heartbeat);
		session.heartbeat = null;
		for (const state of session.subscriptions.values()) {
			state.confirmed = false;
			state.requested = false;
			state.replaying = false;
			state.replayBuffer = [];
			if (state.confirmationRetry) clearTimeout(state.confirmationRetry);
			state.confirmationRetry = null;
		}
		if (session.disposed || session.reconnectTimer || session.subscriptions.size === 0) return;
		const delay = Math.min(1000 * 2 ** session.reconnectAttempt, 30_000) + Math.floor(Math.random() * 500);
		session.reconnectAttempt++;
		session.reconnectTimer = setTimeout(() => {
			session.reconnectTimer = null;
			void this.ensureConnection(session).catch((error) =>
				this.logger.warn(`Failed to reconnect Enhancer WebSocket for tab ${session.tabId}:`, error),
			);
		}, delay);
	}

	private async broadcast(session: EnhancerApiSession, message: WorkerBroadcast): Promise<void> {
		await chrome.tabs.sendMessage(session.tabId, message, { frameId: session.frameId });
	}

	private closeTabSessions(tabId: number): void {
		for (const [key, session] of this.sessions) {
			if (session.tabId !== tabId) continue;
			this.closeSession(session);
			this.sessions.delete(key);
		}
	}

	private closeSession(session: EnhancerApiSession): void {
		session.disposed = true;
		if (session.heartbeat) clearInterval(session.heartbeat);
		if (session.reconnectTimer) clearTimeout(session.reconnectTimer);
		for (const state of session.subscriptions.values()) {
			state.active = false;
			this.releaseSubscription(state);
			void this.clearCursor(session, state);
		}
		session.socket?.close();
	}
}
