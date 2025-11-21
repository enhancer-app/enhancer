import type { TwitchSettings } from "$types/platforms/twitch/twitch.settings.types.ts";

export const TWITCH_DEFAULT_SETTINGS: TwitchSettings = {
	chatImagesEnabled: false,
	chatImagesOnHover: false,
	chatImagesSize: 15,
	chatBadgesEnabled: true,
	chatNicknameCustomizationEnabled: true,
	chatMessageMenuEnabled: true,
	chatMessageMenuUseAddInsteadOfSet: false,
	chatMentionSoundEnabled: false,
	chatMentionSoundSource: "",
	chatMentionSoundVolume: 50,
	pinnedStreamers: [],
	quickAccessLinks: [
		{ title: "TwitchTracker", url: "https://twitchtracker.com/%username%" },
		{ title: "Sullygnome", url: "https://sullygnome.com/channel/%username%" },
		{ title: "Emotes", url: "https://emotes.enhancer.at/?username=%username%" },
	],
	streamLatencyEnabled: true,
	streamLatencyReducerEnabled: false,
	streamLatencyReducerCatchUpRate: 1.1,
	streamLatencyReducerThreshold: 5,
	realVideoTimeEnabled: true,
	realVideoTimeFormat12h: false,
	pinnedStreamersEnabled: true,
	xayoWatchtimeEnabled: true,
	channelSection: true,
};
