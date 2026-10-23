import type {
	EnhancerAccount,
	EnhancerAggregateTopic,
	EnhancerBadge,
	EnhancerBufferedEvent,
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

export type AggregateAccountEntry = [string, EnhancerAccount | null];
export type AggregateBadgeEntry = [string, EnhancerBadge | null];

export interface AggregateSnapshotFile {
	hash: string;
	seq: number;
	bytes: Uint8Array;
	base64?: string;
}

export interface AggregateData {
	channelId: string | null;
	platform: Uppercase<PlatformType>;
	epoch: string;
	seq: number;
	snapshot: AggregateSnapshotFile;
	accounts: Map<string, EnhancerAccount | null>;
	badges: Map<string, EnhancerBadge | null>;
}

export interface AggregateSeed {
	topic: EnhancerAggregateTopic;
	hash: string;
	seq: number;
	bytes?: string;
	accounts: AggregateAccountEntry[];
	badges: AggregateBadgeEntry[];
}

export interface StoredAggregateMeta {
	topic: EnhancerAggregateTopic;
	formatVersion: number;
	scope: AggregateScope;
	hash: string;
	seq: number;
	epoch: string;
	channelId: string | null;
	platform: Uppercase<PlatformType>;
	lastUsedAt: number;
}

export interface StoredAggregateSnapshot extends StoredAggregateMeta {
	bytes: Uint8Array;
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
	aggregate?: AggregateData | null;
	cursor?: string;
	replaying: boolean;
	replayComplete: boolean;
	restoring: boolean;
	transitioning: boolean;
	snapshotChanged: boolean;
	forceFresh: boolean;
	generation: number;
	loading?: Promise<void>;
	eventBuffer: EnhancerBufferedEvent[];
	confirmationRetry: ReturnType<typeof setTimeout> | null;
	confirmationWaiters: Set<() => void>;
	syncWaiters: Set<() => void>;
	seenCursors: Set<string>;
	processing: Promise<void>;
	bootstrapPromise?: Promise<SubscriptionState | null>;
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
	sentHashes: Map<EnhancerAggregateTopic, string>;
	awaitingScopes: Set<AggregateScope>;
}

export interface InitializeEnhancerApiPayload {
	platform: PlatformType;
	clientId: string;
	knownHash?: string;
}

export interface JoinEnhancerChannelPayload {
	platform: PlatformType;
	externalId: string;
	clientId: string;
	knownHash?: string;
}

export interface GetEnhancerWatchTimePayload {
	username: string;
	period: XayoWatchtimePeriod;
	platform: PlatformType;
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
	seed: AggregateSeed | null;
	replacementTopic?: EnhancerAggregateTopic;
}

export interface EnhancerApiPatchPayload {
	platform: PlatformType;
	clientId: string;
	topic: EnhancerAggregateTopic;
	seq: number;
	accounts: AggregateAccountEntry[];
	badges: AggregateBadgeEntry[];
}

export interface EnhancerApiMessagePayload {
	platform: PlatformType;
	clientId: string;
	topic: EnhancerAggregateTopic;
	message: EnhancerMessageEvent;
}
