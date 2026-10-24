import type {
	PairSettingDefinition,
	QuickAccessLink,
	SettingDefinition,
} from "$types/shared/components/settings.component.types.ts";

export const SETTING_SECTION = {
	STREAM: "Stream & VODs",
	SIDEBAR: "Sidebar",
	CHANNEL: "Channel & usercards",
	ADVANCED: "Advanced",
	MESSAGES: "Messages",
	COSMETICS: "Cosmetics",
	NOTIFICATIONS: "Notifications",
} as const;

export const WATCHTIME_PERIOD_OPTIONS = [
	{ value: "30d", label: "Last 30 days" },
	{ value: "365d", label: "Last year" },
	{ value: "all", label: "All time" },
];

export function realVideoTimeSettings<T>(categoryId: string): SettingDefinition<T>[] {
	return [
		{
			id: "realVideoTimeEnabled",
			title: "Real video time",
			description: "Shows the real-world time while you watch a VOD.",
			type: "toggle",
			categoryId,
			section: SETTING_SECTION.STREAM,
			tags: ["Enable Real Video Time"],
			requiresRefreshToDisable: true,
		},
		{
			id: "realVideoTimeFormat12h",
			title: "12-hour clock",
			description: "Shows the time as AM/PM instead of 24-hour.",
			type: "toggle",
			categoryId,
			tags: ["12-Hour Time Format"],
			dependsOn: { key: "realVideoTimeEnabled" },
		},
		{
			id: "realVideoTimeDateMode",
			title: "Show date",
			description: "When to show the date next to the time.",
			type: "select",
			categoryId,
			tags: ["Real Video Time Date Display"],
			dependsOn: { key: "realVideoTimeEnabled" },
			options: [
				{ value: "hover", label: "On hover" },
				{ value: "always", label: "Always" },
				{ value: "never", label: "Never" },
			],
		},
	];
}

export function pinnedStreamersSetting<T>(categoryId: string): SettingDefinition<T> {
	return {
		id: "pinnedStreamersEnabled",
		title: "Pin streamers",
		description: "Pin favorites with ★ to keep them at the top of your follow list.",
		hint: "Pins are shared between Twitch and Kick.",
		type: "toggle",
		categoryId,
		section: SETTING_SECTION.SIDEBAR,
		tags: ["Enable Pinning Streamers"],
	};
}

export function channelSectionSetting<T>(categoryId: string): SettingDefinition<T> {
	return {
		id: "channelSection",
		title: "Channel section",
		description: "Shows a section with your watch time and quick access links.",
		type: "toggle",
		categoryId,
		section: SETTING_SECTION.CHANNEL,
		requiresRefreshToDisable: true,
	};
}

export function chatImagesSettings<T>(categoryId: string): SettingDefinition<T>[] {
	return [
		{
			id: "chatImagesEnabled",
			title: "Images in chat",
			description: "Shows images that people send in chat.",
			type: "toggle",
			categoryId,
			section: SETTING_SECTION.MESSAGES,
			tags: ["Enable Chat Images"],
			confirmOnEnable: true,
			confirmationTitle: "Show images in chat?",
			confirmationMessage:
				"Enhancer does not moderate images that people send in chat. We only display them, so some of them may be unpleasant.",
			confirmText: "Show images",
		},
		{
			id: "chatImagesOnHover",
			title: "Show on hover only",
			description: "Images stay hidden until you hover over them.",
			type: "toggle",
			categoryId,
			tags: ["Show Images on Hover"],
			dependsOn: { key: "chatImagesEnabled" },
		},
		{
			id: "chatImagesSize",
			title: "Maximum image size",
			description: "Images larger than this are not shown.",
			type: "number",
			categoryId,
			tags: ["Chat Image Size"],
			min: 1,
			step: 1,
			unit: "MB",
			dependsOn: { key: "chatImagesEnabled" },
		},
	];
}

export function cosmeticsSettings<T>(categoryId: string): SettingDefinition<T>[] {
	return [
		{
			id: "chatBadgesEnabled",
			title: "Enhancer badges",
			description: "Shows Enhancer badges next to names in chat.",
			type: "toggle",
			categoryId,
			section: SETTING_SECTION.COSMETICS,
			tags: ["Enable Chat Badges"],
		},
		{
			id: "chatNicknameCustomizationEnabled",
			title: "Custom nicknames",
			description: "Shows the names, glow and fonts that people set in Enhancer.",
			type: "toggle",
			categoryId,
			section: SETTING_SECTION.COSMETICS,
			tags: ["Enable Nickname Customization"],
		},
		{
			id: "loadAdditionalFonts",
			title: "Nickname fonts",
			description: "Loads the fonts people chose for their nicknames.",
			hint: "Fonts are loaded from fonts.enhancer.at. Turn this off to use the default font.",
			type: "toggle",
			categoryId,
			tags: ["Additional fonts", "Enable Loading Additional Fonts"],
			dependsOn: { key: "chatNicknameCustomizationEnabled" },
			requiresRefreshToDisable: true,
		},
	];
}

export function quickAccessLinksSetting<T>(categoryId: string, defaultValue: QuickAccessLink[]): SettingDefinition<T> {
	return {
		id: "quickAccessLinks",
		title: "Quick access links",
		description: "Links shown in the channel section.",
		hint: "Use %username% in a link to insert the streamer's name.",
		type: "array",
		categoryId,
		arrayItemFields: [
			{ name: "title", placeholder: "Name", width: "narrow" },
			{ name: "url", placeholder: "https://example.com/%username%", validate: "url" },
		],
		confirmOnRemove: true,
		reorderable: true,
		defaultValue,
		variables: ["%username%"],
		addLabel: "Add link",
		itemLabel: "link",
	};
}

export function latencySettings<T>(
	categoryId: string,
	options: { reducerHint?: string; thresholdStep: number },
): SettingDefinition<T>[] {
	return [
		{
			id: "streamLatencyEnabled",
			title: "Show stream delay",
			description: "Shows the current stream delay above chat.",
			type: "toggle",
			categoryId,
			tags: ["Enable Stream Latency"],
			requiresRefreshToDisable: true,
		},
		{
			id: "streamLatencyReducerEnabled",
			title: "Latency reducer",
			description: "Speeds up playback a little to catch up with the live stream.",
			hint: options.reducerHint,
			type: "toggle",
			categoryId,
			tags: ["Enable Stream Latency Reducer"],
			requiresRefreshToDisable: true,
		},
		{
			id: "streamLatencyReducerRate",
			title: "Playback speed",
			description: "How fast the stream plays while it catches up.",
			type: "pair",
			keys: ["streamLatencyReducerMinRate", "streamLatencyReducerMaxRate"] as PairSettingDefinition<T>["keys"],
			categoryId,
			tags: ["Minimum Playback Rate", "Maximum Playback Rate"],
			dependsOn: { key: "streamLatencyReducerEnabled" },
			min: 1,
			max: 2,
			step: 0.01,
			unit: "×",
			orderError: "The first speed can't be higher than the second one.",
		},
		{
			id: "streamLatencyReducerThreshold",
			title: "Delay threshold",
			description: "Speed-up starts at the lower delay and reaches full speed at the higher one.",
			type: "pair",
			keys: [
				"streamLatencyReducerMinThreshold",
				"streamLatencyReducerMaxThreshold",
			] as PairSettingDefinition<T>["keys"],
			categoryId,
			tags: ["Minimum Latency Threshold", "Maximum Latency Threshold"],
			dependsOn: { key: "streamLatencyReducerEnabled" },
			min: 0,
			step: options.thresholdStep,
			unit: "s",
			orderError: "The lower delay can't be higher than the higher one.",
		},
	];
}

export function followsSettings<T>(categoryId: string): SettingDefinition<T>[] {
	return [
		{
			id: "crossPlatformFollowsSyncEnabled",
			title: "Share follows between Twitch and Kick",
			description: "Combines the channels you follow on both sites.",
			hint: "Applies to both sites. After turning it on, open twitch.tv and kick.com once while logged in.",
			type: "toggle",
			categoryId,
			confirmOnEnable: true,
			confirmationTitle: "Share follows between Twitch and Kick?",
			confirmationMessage: "Enhancer will show the channels you follow on Twitch and Kick together in one list.",
			confirmationFacts: [
				{
					term: "What it uses",
					detail:
						"Your Twitch follows are read on twitch.tv while you browse it. For Kick, Enhancer uses your Kick login to load the channels you follow and check which of them are live.",
				},
				{
					term: "Only for this",
					detail:
						"Your Kick login is used only to load your follows and check who is live. Enhancer will always ask before any other feature uses it.",
				},
				{
					term: "Where it's kept",
					detail:
						"Your follow lists and Kick login stay on this computer. The login is encrypted and kept where websites and other extensions can't access it. Your Twitch login is never saved.",
				},
				{ term: "Where it's sent", detail: "Only to Twitch and Kick. Nothing is sent to Enhancer's servers." },
				{
					term: "When it's removed",
					detail:
						"Turning this off deletes your saved follow lists right away. Your Kick login is deleted as soon as no feature you've turned on needs it. Logging out of Kick also removes it.",
				},
			],
			confirmationNote:
				"This is optional and applies to both Twitch and Kick. If you're not comfortable with it, leave it off. The rest of Enhancer works the same without it.",
			confirmText: "Turn on",
		},
		{
			id: "crossPlatformFollowsDisplayEnabled",
			title: "Merged follow list",
			description: "Shows one list of your Twitch and Kick follows in the sidebar.",
			hint: "Pin channels to keep them on top. Applies to both sites.",
			type: "toggle",
			categoryId,
			dependsOn: { key: "crossPlatformFollowsSyncEnabled" },
		},
		{
			id: "followsHomeEnabled",
			title: "Followed streams home page",
			description: "Replaces the Twitch and Kick home pages with the live streams you follow.",
			hint: "Hover a stream to watch a muted preview.",
			type: "toggle",
			categoryId,
			dependsOn: { key: "crossPlatformFollowsSyncEnabled" },
		},
	];
}
