import type {
	EnhancerAggregatePage,
	EnhancerChannelDto,
	EnhancerMessageEvent,
	EnhancerStateEvent,
	EnhancerSubscription,
} from "$types/apis/enhancer.apis.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";

export type EnhancerApiAction =
	| "initializeEnhancerApi"
	| "joinEnhancerChannel"
	| "getEnhancerWatchTime"
	| "disconnectEnhancerApi";

export type AggregateScope = "GLOBAL" | "CHANNEL";

export interface CachedPage {
	etag: string;
	body: EnhancerAggregatePage;
}

export interface SubscriptionState {
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

export interface EnhancerApiSession {
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

export interface InitializeEnhancerApiPayload {
	platform: PlatformType;
	clientId: string;
}

export interface JoinEnhancerChannelPayload {
	platform: PlatformType;
	externalId: string;
	clientId: string;
}

export interface GetEnhancerWatchTimePayload {
	username: string;
}

export interface DisconnectEnhancerApiPayload {
	platform: PlatformType;
	clientId: string;
}

export interface EnhancerApiUpdatedPayload {
	platform: PlatformType;
	clientId: string;
	scope: "GLOBAL" | "CHANNEL";
	externalId?: string;
	aggregate: EnhancerChannelDto | null;
}

export interface EnhancerApiMessagePayload {
	platform: PlatformType;
	clientId: string;
	message: EnhancerMessageEvent;
}
