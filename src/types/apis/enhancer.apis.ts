import type { PlatformType } from "$types/shared/platform.types.ts";

export type EnhancerBadge = {
	badgeId: string;
	name: string;
	sources: Record<string, string>;
	priority: number;
};

export type EnhancerAccount = {
	accountId?: string;
	externalId: string;
	badgesIds: string[];
	customNickname: string | null;
	hasGlow: boolean;
	customFont: string | null;
};

export type EnhancerGlobalTopic = `global:${Uppercase<PlatformType>}`;
export type EnhancerChannelTopic = `channel:${Uppercase<PlatformType>}:${string}`;
export type EnhancerAggregateTopic = EnhancerGlobalTopic | EnhancerChannelTopic;

export type EnhancerSubscription =
	| { scope: "GLOBAL"; platform: Uppercase<PlatformType> }
	| { scope: "CHANNEL" | "USER"; platform: Uppercase<PlatformType>; externalId: string };

export type EnhancerMessageEvent = {
	type: "message";
	target: EnhancerSubscription;
	name: string;
	data?: unknown;
	cursor: string;
};

export type EnhancerAggregateUpdatedEvent = {
	type: "aggregate.updated";
	topic: EnhancerAggregateTopic;
	epoch: string;
	seq: number;
	accountsUpsert: EnhancerAccount[];
	accountIdsRemove: string[];
	externalIdsRemove: string[];
	badgesUpsert: EnhancerBadge[];
	badgeIdsRemove: string[];
	cursor?: string;
};

export type EnhancerAggregateHeadEvent = {
	type: "aggregate.head";
	topic: EnhancerAggregateTopic;
	epoch: string;
	seq: number;
	snapshot: { hash: string; seq: number; path: string };
	resync: boolean;
	from: number;
};

export type EnhancerSnapshotAppearance = [customNickname: string | null, customFont: string | null, hasGlow: boolean];

export type EnhancerSnapshotHeader = {
	topic: EnhancerAggregateTopic;
	platform: Uppercase<PlatformType>;
	channelId: string | null;
	epoch: string;
	seq: number;
	badges: EnhancerBadge[];
	appearances: [string, string | null, string | null, number][];
	textAccounts: [string, number[]][];
};

export type EnhancerChannelAvailableEvent = {
	type: "channel.available";
	topic: EnhancerChannelTopic;
	reason: "created" | "restored" | "renamed";
	cursor: string;
};

export type EnhancerChannelUnavailableEvent = {
	type: "channel.unavailable";
	topic: EnhancerChannelTopic;
	reason: "archived" | "renamed";
	replacementTopic?: EnhancerChannelTopic;
	cursor: string;
};

export type EnhancerStateEvent =
	| EnhancerAggregateUpdatedEvent
	| EnhancerAggregateHeadEvent
	| EnhancerChannelAvailableEvent
	| EnhancerChannelUnavailableEvent;

export type EnhancerDataEvent = EnhancerMessageEvent | EnhancerAggregateUpdatedEvent;
export type EnhancerBufferedEvent = EnhancerDataEvent | EnhancerChannelAvailableEvent | EnhancerChannelUnavailableEvent;

export type EnhancerWebSocketMessage =
	| { type: "connection.ready" }
	| { type: "subscription.confirmed" | "subscription.removed" | "replay.complete"; topic: EnhancerAggregateTopic }
	| { type: "pong" }
	| { type: "error"; code: string }
	| { error: { code: string; message: string } }
	| EnhancerMessageEvent
	| EnhancerStateEvent;

export type EnhancerApiError = {
	error: {
		code: string;
		message: string;
	};
};

export type XayoWatchtimePeriod = "30d" | "365d" | "all";

export type EnhancerStreamerWatchTimeData = {
	streamerName: string;
	minutes: number;
	lastSeen: string;
	avatarUrl?: string;
};
