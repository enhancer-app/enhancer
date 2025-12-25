import type { QuickAccessLink } from "$types/shared/components/settings.component.types.ts";

export type TwitchSettings = {
	chatImagesEnabled: boolean;
	chatImagesOnHover: boolean;
	chatImagesSize: number;
	chatBadgesEnabled: boolean;
	chatNicknameCustomizationEnabled: boolean;
	chatMessageMenuEnabled: boolean;
	chatMessageMenuUseAddInsteadOfSet: boolean;
	chatMentionSoundEnabled: boolean;
	/**
	 * @deprecated Use chatMentionSoundFile instead. This field is kept for backward compatibility only.
	 */
	chatMentionSoundSource: string;
	chatMentionSoundFile: string;
	chatMentionSoundVolume: number;
	quickAccessLinks: QuickAccessLink[];
	pinnedStreamers: string[];
	streamLatencyEnabled: boolean;
	realVideoTimeEnabled: boolean;
	realVideoTimeFormat12h: boolean;
	pinnedStreamersEnabled: boolean;
	xayoWatchtimeEnabled: boolean;
	channelSection: boolean;
};

export type TwitchSettingsEvents = {
	[K in keyof TwitchSettings as `twitch:settings:${K & string}`]: (value: TwitchSettings[K]) => void | Promise<void>;
};
