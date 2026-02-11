import type { KickSettings } from "$types/platforms/kick/kick.settings.types.ts";

export const KICK_DEFAULT_SETTINGS: KickSettings = {
	chatImagesEnabled: false,
	chatImagesOnHover: false,
	chatImagesSize: 15,
	chatBadgesEnabled: true,
	chatNicknameCustomizationEnabled: true,
	loadAdditionalFonts: true,
	chatMessageMenuEnabled: true,
	quickAccessLinks: [{ title: "Streams Charts", url: "https://streamscharts.com/channels/%username%?platform=kick" }],
	streamLatencyEnabled: true,
	streamLatencyReducerEnabled: false,
	streamLatencyReducerMinRate: 1.05,
	streamLatencyReducerMaxRate: 1.1,
	streamLatencyReducerMinThreshold: 3,
	streamLatencyReducerMaxThreshold: 6,
	realVideoTimeEnabled: true,
	realVideoTimeFormat12h: false,
	channelSection: true,
	shareFollowersEnabled: false,
	displaySharedFollowersEnabled: false,
};
