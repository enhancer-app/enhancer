import type { ChatMonitorChannel } from "$types/shared/chat-monitor/chat-monitor.types.ts";
import type { QuickAccessLink } from "$types/shared/components/settings.component.types.ts";

export type KickSettings = {
	chatImagesEnabled: boolean;
	chatImagesOnHover: boolean;
	chatImagesSize: number;
	chatBadgesEnabled: boolean;
	chatNicknameCustomizationEnabled: boolean;
	loadAdditionalFonts: boolean;
	chatMessageMenuEnabled: boolean;
	quickAccessLinks: QuickAccessLink[];
	streamLatencyEnabled: boolean;
	realVideoTimeEnabled: boolean;
	realVideoTimeFormat12h: boolean;
	channelSection: boolean;
	chatMonitorEnabled: boolean;
	chatMonitorChannels: ChatMonitorChannel[];
	chatMonitorKeywords: string[];
};

export type KickSettingsEvents = {
	[K in keyof KickSettings as `kick:settings:${K & string}`]: (value: KickSettings[K]) => void | Promise<void>;
};
