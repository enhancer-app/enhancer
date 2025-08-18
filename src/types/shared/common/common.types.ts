import type { PlatformType } from "$types/shared/platform.types.ts";

export type CommonKeyByPlatform = {
	readonly twitch: {
		readonly kickStreamers: string[];
	};
	readonly kick: {
		readonly twitchStreamers: string[];
	};
};

export type CommonPlatform = keyof CommonKeyByPlatform & PlatformType;

export type CommonKey<P extends CommonPlatform> = keyof CommonKeyByPlatform[P] & string;

export type CommonValue<P extends CommonPlatform, K extends CommonKey<P>> = CommonKeyByPlatform[P][K];

export const COMMON_KEYS = {
	twitch: {
		kickStreamers: "kickStreamers" as const,
	},
	kick: {
		twitchStreamers: "twitchStreamers" as const,
	},
} as const;

export type CommonRecord = {
	id: string;
	platform: PlatformType;
	key: string;
	value: unknown;
	lastUpdate: number;
};
