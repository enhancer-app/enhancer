import type { QuickAccessLink } from "$types/shared/components/settings.component.types.ts";

export type KickSettings = {
	chatImagesEnabled: boolean;
	chatImagesOnHover: boolean;
	chatImagesSize: number;
	chatBadgesEnabled: boolean;
	chatNicknameCustomizationEnabled: boolean;
	chatMessageMenuEnabled: boolean;
	quickAccessLinks: QuickAccessLink[];
	streamLatencyEnabled: boolean;
	streamLatencyReducerEnabled: boolean;
	streamLatencyReducerMinRate: number;
	streamLatencyReducerMaxRate: number;
	streamLatencyReducerThreshold: number;
	realVideoTimeEnabled: boolean;
	realVideoTimeFormat12h: boolean;
	channelSection: boolean;
};

export type KickSettingsEvents = {
	[K in keyof KickSettings as `kick:settings:${K & string}`]: (value: KickSettings[K]) => void | Promise<void>;
};
