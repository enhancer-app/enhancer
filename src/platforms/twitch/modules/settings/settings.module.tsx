import { ExportImportComponent } from "$shared/components/export-import/export-import.component.tsx";
import { EnhancerAboutComponent } from "$shared/components/settings/about.component.tsx";
import { WatchtimeListComponent } from "$shared/components/watchtime-list/watchtime-list.component.tsx";
import { SettingsHelper } from "$shared/module/helpers/settings.helper.tsx";
import { TWITCH_DEFAULT_SETTINGS } from "$twitch/twitch.constants.ts";
import TwitchModule from "$twitch/twitch.module.ts";
import type { TwitchSettings } from "$types/platforms/twitch/twitch.settings.types.ts";
import type { SettingCategory, SettingDefinition } from "$types/shared/components/settings.component.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import type { Signal } from "@preact/signals";

const CATEGORY = {
	GENERAL: "general",
	CHAT: "chat",
	CHANNEL: "channel",
	FOLLOWERS: "followers",
	LATENCY: "latency",
	ABOUT: "about",
} as const;

export default class SettingsModule extends TwitchModule {
	config: TwitchModuleConfig = {
		name: "settings",
		appliers: [
			{
				type: "event",
				event: "extension:start",
				callback: this.run.bind(this),
				key: "settings",
			},
			{
				type: "event",
				event: "extension:settings-open",
				callback: () => this.openSettings(),
				key: "settings-open",
			},
			{
				type: "event",
				event: "extension:settings-refresh",
				callback: () => this.loadSettings(),
				key: "settings-refresh",
			},
		],
	};

	private settingsHelper: SettingsHelper<TwitchSettings> | null = null;
	private SETTINGS_CATEGORIES: SettingCategory[] = [];
	private SETTING_DEFINITIONS: SettingDefinition<TwitchSettings>[] = [];
	private settingsSignal: Signal<TwitchSettings> | null = null;
	private openSettingsFn: (() => void) | null = null;

	async initialize() {
		this.settingsHelper = new SettingsHelper<TwitchSettings>(
			this.settingsCache(),
			this.workerService(),
			this.emitter,
			this.logger,
			this.commonUtils(),
		);

		const workerService = this.workerService();
		this.SETTINGS_CATEGORIES = [
			{ id: CATEGORY.GENERAL, title: "General", order: 0 },
			{ id: CATEGORY.CHAT, title: "Chat", order: 1 },
			{ id: CATEGORY.CHANNEL, title: "Channel", order: 2 },
			{ id: CATEGORY.FOLLOWERS, title: "Followers", order: 3 },
			{ id: CATEGORY.LATENCY, title: "Latency", order: 4 },
			{ id: CATEGORY.ABOUT, title: "About", order: 5 },
		];

		const brandIcons = {
			website: await this.commonUtils().getAssetFile(this.workerService(), "brands/website.svg"),
			github: await this.commonUtils().getAssetFile(this.workerService(), "brands/github.svg"),
			twitter: await this.commonUtils().getAssetFile(this.workerService(), "brands/twitter.svg"),
			discord: await this.commonUtils().getAssetFile(this.workerService(), "brands/discord.svg"),
			email: await this.commonUtils().getAssetFile(this.workerService(), "brands/email.svg"),
		} as const;

		this.SETTING_DEFINITIONS = [
			{
				id: "chattersEnabled",
				title: "Enable Chatters Counter",
				description: "Shows the number of chatters (users connected to chat) next to the viewer count.",
				type: "toggle",
				categoryId: CATEGORY.GENERAL,
				requiresRefreshToDisable: true,
			},
			{
				id: "realVideoTimeEnabled",
				title: "Enable Real Video Time",
				description: "Displays the real-world time of the VOD.",
				type: "toggle",
				categoryId: CATEGORY.GENERAL,
				requiresRefreshToDisable: true,
			},
			{
				id: "xayoWatchtimeEnabled",
				title: "Enabled Usercard Watchtime",
				description:
					"Displays watchtime in usercards and via the /watchtime command for Polish channels by xayo.pl service.",
				type: "toggle",
				categoryId: CATEGORY.GENERAL,
				requiresRefreshToDisable: true,
			},
			{
				id: "realVideoTimeFormat12h",
				title: "12-Hour Time Format",
				description: "Display real video time in 12-hour format (AM/PM) instead of 24-hour format.",
				type: "toggle",
				categoryId: CATEGORY.GENERAL,
			},
			{
				id: "channelSection",
				title: "Channel Section",
				description: "Shows a section with watch time and quick access links.",
				type: "toggle",
				categoryId: CATEGORY.GENERAL,
				requiresRefreshToDisable: true,
			},
			{
				id: "loadAdditionalFonts",
				title: "Enable Loading Additional Fonts",
				description: "Loads additional font assets used by Enhancer for enhanced visual variety.",
				type: "toggle",
				categoryId: CATEGORY.GENERAL,
				requiresRefreshToDisable: true,
			},
			{
				id: "chatImagesEnabled",
				title: "Enable Chat Images",
				description: "Display images sent in chat messages.",
				type: "toggle",
				categoryId: CATEGORY.CHAT,
				confirmOnEnable: true,
				confirmationMessage:
					"Enhancer is not responsible for the content of images sent in the chat by users. By enabling this option, you can see images in the chat that may not look good. We do not moderate them in any way, we simply display them. Are you sure you want to enable this option?",
			},
			{
				id: "chatImagesOnHover",
				title: "Show Images on Hover",
				description: "Images are hidden until you hover your mouse to reveal them.",
				type: "toggle",
				categoryId: CATEGORY.CHAT,
			},
			{
				id: "chatImagesSize",
				title: "Chat Image Size",
				description: "Maximum size of images allowed in chat messages (in megabytes).",
				type: "number",
				categoryId: CATEGORY.CHAT,
				min: 1,
				step: 1,
			},
			{
				id: "chatBadgesEnabled",
				title: "Enable Chat Badges",
				description: "Show custom chat badges from Enhancer extension.",
				type: "toggle",
				categoryId: CATEGORY.CHAT,
			},
			{
				id: "chatNicknameCustomizationEnabled",
				title: "Enable Nickname Customization",
				description: "Show custom chat nickname customizations from Enhancer extension in chat.",
				type: "toggle",
				categoryId: CATEGORY.CHAT,
			},
			{
				id: "chatMessageMenuEnabled",
				title: "Enable Chat Message Menu",
				description: "Show a menu with message options when you right-click a chat message.",
				type: "toggle",
				categoryId: CATEGORY.CHAT,
			},
			{
				id: "chatMessageMenuUseAddInsteadOfSet",
				title: "Appending Content via Chat Message Menu",
				description:
					"When using the chat message menu, new content will be added to the message in chat input instead of replacing it.",
				type: "toggle",
				categoryId: CATEGORY.CHAT,
			},
			{
				id: "chatMentionSoundEnabled",
				title: "Enable Chat Mention Sound",
				description: "Turn on to receive a sound notification when someone mentions you in chat.",
				type: "toggle",
				categoryId: CATEGORY.CHAT,
			},
			{
				id: "chatMentionSoundFile",
				title: "Custom Mention Sound File",
				description:
					"Upload a custom audio file to play when you are mentioned in chat. Leave empty to use the default sound.",
				type: "file",
				categoryId: CATEGORY.CHAT,
				validTypes: ["audio/mpeg", "audio/mp3", "audio/ogg", "audio/wav", "audio/webm", "audio/aac", "audio/flac"],
			},
			{
				id: "chatMentionSoundVolume",
				title: "Custom Mention Sound Volume",
				description: "Adjust the volume level for your mention notification sound.",
				type: "number",
				min: 0,
				max: 100,
				step: 1,
				categoryId: CATEGORY.CHAT,
			},
			{
				id: "quickAccessLinks",
				title: "Quick Access Links",
				description:
					"Manage your quick access links. Use %username% in the URL to dynamically include the streamer's name.",
				type: "array",
				categoryId: CATEGORY.CHANNEL,
				arrayItemFields: [
					{ name: "title", placeholder: "Enter link name..." },
					{ name: "url", placeholder: "Enter URL..." },
				],
				confirmOnRemove: true,
				confirmationMessage: "Are you sure you want to remove this Quick Access Link?",
			},
			{
				id: "watchtime-list",
				title: "Watchtime List",
				description: "Watchtime List",
				type: "text",
				categoryId: CATEGORY.CHANNEL,
				content: () => {
					return <WatchtimeListComponent platform="twitch" workerService={workerService} emitter={this.emitter} />;
				},
				hideInfo: true,
			},
			{
				id: "export-import",
				title: "Export/Import Data",
				description: "Export and import your settings and watchtime data",
				type: "text",
				categoryId: CATEGORY.GENERAL,
				content: () => {
					return <ExportImportComponent platform="twitch" workerService={workerService} emitter={this.emitter} />;
				},
				hideInfo: true,
			},
			{
				id: "pinnedStreamersEnabled",
				title: "Enable Pinning Streamers",
				description: "Allows you to pin your favorite streamers for easy access.",
				type: "toggle",
				categoryId: CATEGORY.FOLLOWERS,
				requiresRefreshToDisable: true,
			},
			{
				id: "_showCrossPlatformFollows",
				title: "Cross-Platform Live Follows",
				description: "Display live followed streamers from other platforms in your sidebar.",
				type: "toggle",
				categoryId: CATEGORY.FOLLOWERS,
				requiresRefreshToDisable: true,
				experimental: true,
			},
			{
				id: "_syncCrossPlatformFollows",
				title: "Sync Follows Across Platforms",
				description: "Share your followed streamers so they appear on other platforms where you have this enabled.",
				type: "toggle",
				categoryId: CATEGORY.FOLLOWERS,
				requiresRefreshToDisable: true,
				experimental: true,
			},
			{
				id: "streamLatencyEnabled",
				title: "Enable Stream Latency",
				description: "Shows the current stream delay on top of the chat.",
				type: "toggle",
				categoryId: CATEGORY.LATENCY,
				requiresRefreshToDisable: true,
			},
			{
				id: "streamLatencyReducerEnabled",
				title: "Enable Stream Latency Reducer",
				description: "Reduces stream latency by adjusting playback rate. (Disabled without Low Latency Mode)",
				type: "toggle",
				categoryId: CATEGORY.LATENCY,
				requiresRefreshToDisable: true,
				experimental: true,
			},
			{
				id: "streamLatencyReducerMinRate",
				title: "Minimum Playback Rate",
				description: "The minimum playback rate the stream will be speeded up to.",
				type: "number",
				categoryId: CATEGORY.LATENCY,
				requiresRefreshToDisable: true,
			},
			{
				id: "streamLatencyReducerMaxRate",
				title: "Maximum Playback Rate",
				description: "The maximum playback rate the stream will be speeded up to.",
				type: "number",
				categoryId: CATEGORY.LATENCY,
				requiresRefreshToDisable: true,
			},
			{
				id: "streamLatencyReducerMinThreshold",
				title: "Minimum Latency Threshold",
				description:
					"The latency threshold (in seconds) at which the playback rate will be speeded up to the minimum rate.",
				type: "number",
				categoryId: CATEGORY.LATENCY,
				requiresRefreshToDisable: true,
			},
			{
				id: "streamLatencyReducerMaxThreshold",
				title: "Maximum Latency Threshold",
				description:
					"The latency threshold (in seconds) at which the playback rate will be speeded up to the maximum rate.",
				type: "number",
				categoryId: CATEGORY.LATENCY,
				requiresRefreshToDisable: true,
			},
			{
				id: "about",
				title: "About This Extension",
				description: "Information about the extension",
				type: "text",
				categoryId: CATEGORY.ABOUT,
				content: () => {
					return <EnhancerAboutComponent icons={brandIcons} />;
				},
				hideInfo: true,
			},
		];

		if (this.commonUtils().isFunnyDay()) {
			this.SETTING_DEFINITIONS = [
				{
					id: "_funnyThings",
					title: "Enable Funny Things",
					description: "Enables Funny Things, on Funny Day, right?",
					type: "toggle",
					categoryId: CATEGORY.GENERAL,
					requiresRefreshToDisable: true,
				},
				...this.SETTING_DEFINITIONS,
			];
		}
	}

	private async run() {
		if (!this.settingsHelper) return;
		const settings = this.settingsHelper.loadSettings(TWITCH_DEFAULT_SETTINGS);
		const result = await this.settingsHelper.createSettingsContainer({
			defaults: settings,
			categories: this.SETTINGS_CATEGORIES,
			definitions: this.SETTING_DEFINITIONS,
			eventPrefix: "twitch:settings:",
		});
		this.settingsSignal = result.settingsSignal;
		this.openSettingsFn = result.openSettings;
		this.settingsHelper.setupKeyboardShortcut();
	}

	private loadSettings() {
		if (!this.settingsHelper) return;
		this.settingsHelper.loadSettings(TWITCH_DEFAULT_SETTINGS);
	}
	private openSettings() {
		this.openSettingsFn?.();
	}
}
