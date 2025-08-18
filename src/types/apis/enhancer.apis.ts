import type { PlatformType } from "$types/shared/platform.types.ts";

export type EnhancerBadge = {
	badgeId: string;
	name: string;
	description: string;
	sources: Record<EnhancerBadgeSize, string>;
	priority: number;
};

export type EnhancerUser = {
	userId: string;
	externalId: string;
	badgesIds: string[];
	customNickname: string | null;
	hasGlow: boolean;
};

export type EnhancerBadgeSize = "1x" | "2x" | "4x";

export type EnhancerChannelDto = {
	channelId: string;
	platform: PlatformType; //TODO Its upperCase
	playSoundsEnabled: boolean;
	partner: boolean;
	users: EnhancerUser[];
	badges: EnhancerBadge[];
};

export type EnhancerResponseMap = {
	channel: EnhancerChannelDto;
};

export type EnhancerStreamerWatchTimeData = {
	streamer: string;
	count: number;
};
