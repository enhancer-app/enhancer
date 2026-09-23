import type { XayoWatchtimePeriod } from "$types/apis/enhancer.apis.ts";
import type { QuickAccessLink } from "$types/shared/components/settings.component.types.ts";

export type KickForceQualityPreference = "highest" | "1080" | "720" | "480" | "360" | "160";

export type KickSettings = {
	forceQualityEnabled: boolean;
	forceQualityPreferred: KickForceQualityPreference;
	chatImagesEnabled: boolean;
	chatImagesOnHover: boolean;
	chatImagesSize: number;
	chatBadgesEnabled: boolean;
	chatNicknameCustomizationEnabled: boolean;
	loadAdditionalFonts: boolean;
	chatMessageMenuEnabled: boolean;
	quickAccessLinks: QuickAccessLink[];
	streamLatencyEnabled: boolean;
	streamLatencyReducerEnabled: boolean;
	streamLatencyReducerMinRate: number;
	streamLatencyReducerMaxRate: number;
	streamLatencyReducerMinThreshold: number;
	streamLatencyReducerMaxThreshold: number;
	realVideoTimeEnabled: boolean;
	realVideoTimeFormat12h: boolean;
	xayoWatchtimeEnabled: boolean;
	xayoWatchtimePeriod: XayoWatchtimePeriod;
	channelSection: boolean;
	_disableExtensionOnDashboard: boolean;
};

export type KickSettingsEvents = {
	[K in keyof KickSettings as `kick:settings:${K & string}`]: (value: KickSettings[K]) => void | Promise<void>;
};
