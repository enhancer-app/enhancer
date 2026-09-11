import type {
	EnhancerAccount,
	EnhancerAggregateSnapshotEvent,
	EnhancerAggregateTopic,
	EnhancerBadge,
	EnhancerBufferedEvent,
	EnhancerChannelDto,
	EnhancerMessageEvent,
	EnhancerSubscription,
	XayoWatchtimePeriod,
} from "$types/apis/enhancer.apis.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";

export type EnhancerApiAction =
	| "initializeEnhancerApi"
	| "joinEnhancerChannel"
	| "getEnhancerWatchTime"
	| "disconnectEnhancerApi";

export type AggregateScope = "GLOBAL" | "CHANNEL";

export interface CachedAggregateSeed {
	topic: EnhancerAggregateTopic;
	aggregate: EnhancerChannelDto;
	cursor: string;
}

export interface AggregateMaps {
	channelId: string | null;
	platform: Uppercase<PlatformType>;
	accounts: Map<string, EnhancerAccount>;
	badges: Map<string, EnhancerBadge>;
}

export interface AggregateSnapshot {
	snapshotId: string;
	cursor: string;
	pages: Map<number, EnhancerAggregateSnapshotEvent>;
	lastPage?: number;
}

export interface SubscriptionState {
	topic: EnhancerAggregateTopic;
	platform: PlatformType;
	scope: AggregateScope;
	externalId?: string;
	subscription: EnhancerSubscription;
	subscribers: Set<string>;
	confirmed: boolean;
	rejected: boolean;
	requested: boolean;
	active: boolean;
	aggregate?: AggregateMaps | null;
	cursor?: string;
	replaying: boolean;
	replayComplete: boolean;
	seedCollecting: boolean;
	transitioning: boolean;
	eventBuffer: EnhancerBufferedEvent[];
	snapshot?: AggregateSnapshot;
	confirmationRetry: ReturnType<typeof setTimeout> | null;
	confirmationWaiters: Set<() => void>;
	syncWaiters: Set<() => void>;
	seenCursors: Set<string>;
	processing: Promise<void>;
	bootstrapPromise?: Promise<CachedAggregateSeed | null>;
	redirect?: SubscriptionState;
}

export interface EnhancerApiClient {
	tabId: number;
	frameId: number;
	clientId: string;
	platform: PlatformType;
	topics: Set<EnhancerAggregateTopic>;
	channelTopic?: EnhancerAggregateTopic;
	generation: number;
}

export interface InitializeEnhancerApiPayload {
	platform: PlatformType;
	clientId: string;
	seed?: CachedAggregateSeed;
}

export interface JoinEnhancerChannelPayload {
	platform: PlatformType;
	externalId: string;
	clientId: string;
	seed?: CachedAggregateSeed;
}

export interface GetEnhancerWatchTimePayload {
	username: string;
	period: XayoWatchtimePeriod;
}

export interface DisconnectEnhancerApiPayload {
	platform: PlatformType;
	clientId: string;
}

export interface EnhancerApiUpdatedPayload {
	platform: PlatformType;
	clientId: string;
	scope: AggregateScope;
	topic: EnhancerAggregateTopic;
	aggregate: EnhancerChannelDto | null;
	cursor: string;
	replacementTopic?: EnhancerAggregateTopic;
}

export interface EnhancerApiMessagePayload {
	platform: PlatformType;
	clientId: string;
	topic: EnhancerAggregateTopic;
	message: EnhancerMessageEvent;
}

export interface EnhancerApiSeedRequestPayload {
	requestId: string;
	topic: EnhancerAggregateTopic;
}
