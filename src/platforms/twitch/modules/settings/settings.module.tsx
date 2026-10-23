import {
	ACCOUNT_CATEGORY_ID,
	createAccountCategories,
	createAccountIdentity,
	createAccountSettings,
	createDeveloperCategories,
	createDeveloperSettings,
} from "$shared/module/helpers/enhancer-account-settings.tsx";
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
	LATENCY: "latency",
	EXPERIMENTAL: "experimental",
	DATA: "data",
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
			"twitch",
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
			{ id: CATEGORY.LATENCY, title: "Latency", order: 3 },
			{ id: CATEGORY.EXPERIMENTAL, title: "Experimental", order: 4 },
			{ id: CATEGORY.DATA, title: "Data", order: 5, placement: "utility" },
			{ id: CATEGORY.ABOUT, title: "About", order: 6, placement: "utility" },
			...createDeveloperCategories(7),
			...createAccountCategories(8),
		];

		const brandIcons = {
			website: await this.commonUtils().getAssetFile(this.workerService(), "brands/website.svg"),
			github: await this.commonUtils().getAssetFile(this.workerService(), "brands/github.svg"),
			twitter: await this.commonUtils().getAssetFile(this.workerService(), "brands/twitter.svg"),
			discord: await this.commonUtils().getAssetFile(this.workerService(), "brands/discord.svg"),
		} as const;
		const enhancerLogo = await this.commonUtils().getAssetFile(this.workerService(), "enhancer/logo.svg");

		this.SETTING_DEFINITIONS = [
			...createAccountSettings(workerService, "twitch", enhancerLogo),
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
				id: "realVideoTimeFormat12h",
				title: "12-Hour Time Format",
				description: "Display real video time in 12-hour format (AM/PM) instead of 24-hour format.",
				type: "toggle",
				categoryId: CATEGORY.GENERAL,
				dependsOn: { key: "realVideoTimeEnabled" },
			},
			{
				id: "realVideoTimeDateMode",
				title: "Real Video Time Date Display",
				description: "Choose when to show the date next to the real video time.",
				type: "select",
				categoryId: CATEGORY.GENERAL,
				dependsOn: { key: "realVideoTimeEnabled" },
				options: [
					{ value: "hover", label: "Show date on hover (default)" },
					{ value: "always", label: "Always show" },
					{ value: "never", label: "Never show" },
				],
			},
			{
				id: "pinnedStreamersEnabled",
				title: "Enable Pinning Streamers",
				description:
					"Pin your favorite streamers with ★ to keep them on top of your follow list. Pins are shared between Twitch and Kick.",
				type: "toggle",
				categoryId: CATEGORY.GENERAL,
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
				id: "xayoWatchtimePeriod",
				title: "Xayo Watchtime Period",
				description: "Select the time range used for usercard watchtime and the /watchtime command.",
				type: "select",
				categoryId: CATEGORY.GENERAL,
				dependsOn: { key: "xayoWatchtimeEnabled" },
				options: [
					{ value: "30d", label: "Last 30 days" },
					{ value: "365d", label: "Last year" },
					{ value: "all", label: "All time" },
				],
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
				id: "hideStories",
				title: "Hide Stories",
				description: "Hides the Stories section and the Save Your Streak prompt in the left sidebar.",
				type: "toggle",
				categoryId: CATEGORY.GENERAL,
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
				dependsOn: { key: "chatImagesEnabled" },
			},
			{
				id: "chatImagesSize",
				title: "Chat Image Size",
				description: "Maximum size of images allowed in chat messages.",
				type: "number",
				categoryId: CATEGORY.CHAT,
				min: 1,
				step: 1,
				unit: "MB",
				dependsOn: { key: "chatImagesEnabled" },
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
				dependsOn: { key: "chatMessageMenuEnabled" },
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
				dependsOn: { key: "chatMentionSoundEnabled" },
			},
			{
				id: "chatMentionSoundVolume",
				title: "Mention Sound Volume",
				description: "Adjust the volume level for your mention notification sound.",
				type: "number",
				min: 0,
				max: 100,
				step: 1,
				unit: "%",
				slider: true,
				categoryId: CATEGORY.CHAT,
				dependsOn: { key: "chatMentionSoundEnabled" },
			},
			{
				id: "chatHideGiphyMessages",
				title: "Filter Giphy Messages",
				description:
					"Hide Giphy messages or replace GIFs with text links. Changes apply to newly processed messages; refresh the page to update existing messages.",
				type: "toggle",
				categoryId: CATEGORY.CHAT,
				hideInfo: false,
			},
			{
				id: "chatGiphyMessageMode",
				title: "Giphy Message Behavior",
				description: "Choose whether to hide the entire message or display the GIF description as a clickable link.",
				type: "radio",
				categoryId: CATEGORY.CHAT,
				dependsOn: { key: "chatHideGiphyMessages" },
				options: [
					{ value: "hide", label: "Hide entire message" },
					{ value: "link", label: "Replace GIF with a text link" },
				],
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
				categoryId: CATEGORY.DATA,
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
				categoryId: CATEGORY.DATA,
				content: () => {
					return <ExportImportComponent platform="twitch" workerService={workerService} emitter={this.emitter} />;
				},
				hideInfo: true,
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
			},
			{
				id: "streamLatencyReducerMinRate",
				title: "Minimum Playback Rate",
				description: "The minimum playback rate the stream will be speeded up to.",
				type: "number",
				categoryId: CATEGORY.LATENCY,
				requiresRefreshToDisable: true,
				dependsOn: { key: "streamLatencyReducerEnabled" },
				min: 1,
				max: 2,
				step: 0.01,
				unit: "x",
			},
			{
				id: "streamLatencyReducerMaxRate",
				title: "Maximum Playback Rate",
				description: "The maximum playback rate the stream will be speeded up to.",
				type: "number",
				categoryId: CATEGORY.LATENCY,
				requiresRefreshToDisable: true,
				dependsOn: { key: "streamLatencyReducerEnabled" },
				min: 1,
				max: 2,
				step: 0.01,
				unit: "x",
			},
			{
				id: "streamLatencyReducerMinThreshold",
				title: "Minimum Latency Threshold",
				description:
					"The latency threshold (in seconds) at which the playback rate will be speeded up to the minimum rate.",
				type: "number",
				categoryId: CATEGORY.LATENCY,
				requiresRefreshToDisable: true,
				dependsOn: { key: "streamLatencyReducerEnabled" },
				min: 0,
				step: 1,
				unit: "s",
			},
			{
				id: "streamLatencyReducerMaxThreshold",
				title: "Maximum Latency Threshold",
				description:
					"The latency threshold (in seconds) at which the playback rate will be speeded up to the maximum rate.",
				type: "number",
				categoryId: CATEGORY.LATENCY,
				requiresRefreshToDisable: true,
				dependsOn: { key: "streamLatencyReducerEnabled" },
				min: 0,
				step: 1,
				unit: "s",
			},
			{
				id: "crossPlatformFollowsSyncEnabled",
				title: "Share Follows Between Twitch and Kick",
				description:
					"Combines the channels you follow on Twitch and Kick. Applies to both sites. After turning it on, open twitch.tv and kick.com once while logged in.",
				type: "toggle",
				categoryId: CATEGORY.EXPERIMENTAL,
				confirmOnEnable: true,
				confirmationTitle: "Share Follows Between Twitch and Kick",
				confirmationMessage:
					"Enhancer will show the channels you follow on Twitch and Kick together in one list.\n\n• What it uses: your Twitch follows are read on twitch.tv while you browse it. For Kick, Enhancer uses your Kick login to load the channels you follow and check which of them are live.\n• Only for this: this feature uses your Kick login only to load your follows and check who is live. Enhancer will always ask you before any other feature uses it.\n• Where it's kept: your follow lists and Kick login are saved on this computer. The login is encrypted and kept in a part of the extension that websites and other extensions can't access. Your Twitch login is never saved.\n• Where it's sent: only to Twitch and Kick. Nothing is sent to Enhancer's servers.\n• When it's removed: turning this off deletes your saved follow lists right away. Your Kick login is deleted as soon as no Enhancer feature you've turned on needs it. Logging out of Kick also removes it.\n\nThis is completely optional. If you're not comfortable with it, leave it off. The rest of Enhancer works the same without it.\n\nThis setting applies to both Twitch and Kick. Enable sharing?",
				confirmText: "Turn on",
			},
			{
				id: "crossPlatformFollowsDisplayEnabled",
				title: "Merged Follow List",
				description:
					"Replaces the followed channels in the sidebar with one list of your Twitch and Kick follows. Pin channels to keep them on top. Applies to both sites.",
				type: "toggle",
				categoryId: CATEGORY.EXPERIMENTAL,
				dependsOn: { key: "crossPlatformFollowsSyncEnabled" },
			},
			{
				id: "followsHomeEnabled",
				title: "Followed Streams Home Page",
				description:
					"Replaces the Twitch and Kick home pages with the live streams you follow on both sites. Hover a stream to watch a muted preview.",
				type: "toggle",
				categoryId: CATEGORY.EXPERIMENTAL,
				dependsOn: { key: "crossPlatformFollowsSyncEnabled" },
			},
			{
				id: "emoteBarEnabled",
				title: "Enable Emote Bar",
				description:
					"Shows your most used emotes for the current channel above the chat input. Click to insert, Ctrl+Click to send, right-click twice to remove.",
				type: "toggle",
				categoryId: CATEGORY.EXPERIMENTAL,
				requiresRefreshToDisable: true,
			},
			{
				id: "about",
				title: "About This Extension",
				description: "Information about the extension",
				type: "text",
				categoryId: CATEGORY.ABOUT,
				content: () => {
					return <EnhancerAboutComponent icons={brandIcons} platform="twitch" workerService={workerService} />;
				},
				hideInfo: true,
			},
			...createDeveloperSettings<TwitchSettings>(CATEGORY.ABOUT),
		];
	}

	private async run() {
		if (!this.settingsHelper) return;
		const settings = this.settingsHelper.loadSettings(TWITCH_DEFAULT_SETTINGS);
		const result = await this.settingsHelper.createSettingsContainer({
			defaults: settings,
			categories: this.SETTINGS_CATEGORIES,
			definitions: this.SETTING_DEFINITIONS,
			eventPrefix: "twitch:settings:",
			identity: createAccountIdentity(this.workerService(), "twitch"),
			identityCategoryId: ACCOUNT_CATEGORY_ID,
		});
		this.settingsSignal = result.settingsSignal;
		this.openSettingsFn = result.openSettings;
	}

	private loadSettings() {
		if (!this.settingsHelper) return;
		this.settingsHelper.loadSettings(TWITCH_DEFAULT_SETTINGS);
	}
	private openSettings() {
		this.openSettingsFn?.();
	}
}
