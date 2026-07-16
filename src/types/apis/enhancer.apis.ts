import type { PlatformType } from "$types/shared/platform.types.ts";

export type EnhancerBadge = {
	badgeId: string;
	name: string;
	sources: Record<string, string>;
	priority: number;
};

export type EnhancerAccount = {
	accountId: string;
	externalId: string;
	badgesIds: string[];
	customNickname: string | null;
	hasGlow: boolean;
	customFont: string | null;
};

export type EnhancerChannelDto = {
	channelId: string | null;
	platform: Uppercase<PlatformType>;
	accounts: EnhancerAccount[];
	badges: EnhancerBadge[];
};

export type EnhancerAggregatePage = EnhancerChannelDto & {
	page: number;
	hasNextPage: boolean;
};

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

export type EnhancerStateEvent =
	| {
			type: "badge.updated";
			platform: Uppercase<PlatformType>;
			badgeId: string;
			channelExternalId?: string;
			changes: {
				sources?: Record<string, string>;
				name?: string;
				priority?: number;
				status?: "ACTIVE" | "DISABLED" | "ARCHIVED";
			};
			cursor: string;
	  }
	| {
			type: "badge-assignment.updated";
			platform: Uppercase<PlatformType>;
			userExternalId: string;
			badgeId: string;
			channelExternalId?: string;
			status: "ACTIVE" | "DISABLED" | "ARCHIVED";
			cursor: string;
	  }
	| {
			type: "appearance.updated";
			platform: Uppercase<PlatformType>;
			userExternalId: string;
			channelExternalId?: string;
			changes: {
				customNickname?: string | null;
				customFont?: string | null;
				hasGlow?: boolean;
				status?: "ACTIVE" | "DISABLED" | "ARCHIVED";
			};
			cursor: string;
	  }
	| {
			type: "sync.required";
			topics: string[];
			reason: "account.updated";
			cursor: string;
	  };

export type EnhancerWebSocketMessage =
	| { type: "connection.ready" }
	| { type: "subscription.confirmed" | "subscription.removed" | "replay.complete"; topic: string }
	| { type: "pong" }
	| { type: "error"; code: string }
	| { type: "sync.required"; topic: string }
	| { error: { code: string; message: string } }
	| EnhancerMessageEvent
	| EnhancerStateEvent;

export type EnhancerApiError = {
	error: {
		code: string;
		message: string;
	};
};

export type EnhancerStreamerWatchTimeData = {
	streamerName: string;
	minutes: number;
	lastSeen: string;
	avatarUrl?: string;
};
