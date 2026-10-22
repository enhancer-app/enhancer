import { KICK_DEFAULT_SETTINGS } from "$kick/kick.constants.ts";
import KickModule from "$kick/kick.module.ts";
import { createAccountCategories, createAccountSettings } from "$shared/module/helpers/enhancer-account-settings.tsx";
import { ExportImportComponent } from "$shared/components/export-import/export-import.component.tsx";
import { EnhancerAboutComponent } from "$shared/components/settings/about.component.tsx";
import { WatchtimeListComponent } from "$shared/components/watchtime-list/watchtime-list.component.tsx";
import { SettingsHelper } from "$shared/module/helpers/settings.helper.tsx";
import type { KickSettings } from "$types/platforms/kick/kick.settings.types.ts";
import type { SettingCategory, SettingDefinition } from "$types/shared/components/settings.component.types.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";
import type { Signal } from "@preact/signals";

const CATEGORY = {
	GENERAL: "general",
	CHAT: "chat",
	CHANNEL: "channel",
	PLAYER: "player",
	LATENCY: "latency",
	EXPERIMENTAL: "experimental",
	ABOUT: "about",
} as const;

export default class SettingsModule extends KickModule {
	config: KickModuleConfig = {
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
			{
				type: "event",
				event: "kick:settings:_disableExtensionOnDashboard",
				callback: (value: boolean) => {
					if (value) {
						document.cookie = "_enhancer_disable_dashboard=true; domain=.kick.com; path=/; max-age=315360000";
					} else {
						document.cookie = "_enhancer_disable_dashboard=; domain=.kick.com; path=/; max-age=0";
					}
				},
				key: "_disableExtensionOnDashboard",
			},
		],
	};

	private settingsHelper: SettingsHelper<KickSettings> | null = null;
	private SETTINGS_CATEGORIES: SettingCategory[] = [];
	private SETTING_DEFINITIONS: SettingDefinition<KickSettings>[] = [];
	private settingsSignal: Signal<KickSettings> | null = null;
	private openSettingsFn: (() => void) | null = null;

	async initialize() {
		this.settingsHelper = new SettingsHelper<KickSettings>(
			"kick",
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
			{ id: CATEGORY.PLAYER, title: "Player", order: 3 },
			{ id: CATEGORY.LATENCY, title: "Latency", order: 4 },
			{ id: CATEGORY.EXPERIMENTAL, title: "Experimental", order: 5 },
			...createAccountCategories(6),
			{ id: CATEGORY.ABOUT, title: "About", order: 7 },
		];

		const brandIcons = {
			website: await this.commonUtils().getAssetFile(this.workerService(), "brands/website.svg"),
			github: await this.commonUtils().getAssetFile(this.workerService(), "brands/github.svg"),
			twitter: await this.commonUtils().getAssetFile(this.workerService(), "brands/twitter.svg"),
			discord: await this.commonUtils().getAssetFile(this.workerService(), "brands/discord.svg"),
		} as const;
		const enhancerLogo = await this.commonUtils().getAssetFile(this.workerService(), "enhancer/logo.svg");

		this.SETTING_DEFINITIONS = [
			...createAccountSettings(workerService, "kick", enhancerLogo),
			{
				id: "pinnedStreamersEnabled",
				title: "Enable Pinning Streamers",
				description:
					"Pin your favorite streamers with ★ to keep them on top of your follow list. Pins are shared between Twitch and Kick.",
				type: "toggle",
				categoryId: CATEGORY.GENERAL,
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
				title: "Use 12-Hour Time Format",
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
				id: "channelSection",
				title: "Channel Section",
				description: "Shows a section with watch time and quick access links.",
				type: "toggle",
				categoryId: CATEGORY.GENERAL,
				requiresRefreshToDisable: true,
			},
			{
				id: "xayoWatchtimeEnabled",
				title: "Enable Usercard Watchtime",
				description: "Displays watchtime in Kick user popups from the xayo.pl service.",
				type: "toggle",
				categoryId: CATEGORY.GENERAL,
				requiresRefreshToDisable: true,
			},
			{
				id: "xayoWatchtimePeriod",
				title: "Xayo Watchtime Period",
				description: "Select the time range used for Kick user popup watchtime.",
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
				id: "_disableExtensionOnDashboard",
				title: "Disable Enhancer on Dashboard",
				description: "Disables loading Enhancer on dashboard page (dashboard.kick.com).",
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
				id: "quickAccessLinks",
				title: "Quick Access Links",
				description: "Manage your quick access links with custom names and URLs",
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
					return <WatchtimeListComponent platform="kick" workerService={workerService} emitter={this.emitter} />;
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
					return <ExportImportComponent platform="kick" workerService={workerService} emitter={this.emitter} />;
				},
				hideInfo: true,
			},
			{
				id: "forceQualityEnabled",
				title: "Force Stream Quality",
				description:
					"Stops the player from starting on Auto and picks a fixed quality instead. Higher quality means more latency and more buffering on a weak connection.",
				type: "toggle",
				categoryId: CATEGORY.PLAYER,
				requiresRefreshToDisable: true,
			},
			{
				id: "forceQualityPreferred",
				title: "Preferred Quality",
				description:
					"The quality to select on every stream. Falls back to the closest lower one when it is unavailable. Source quality is skipped while you are logged out, because Kick reserves it for logged-in viewers.",
				type: "select",
				categoryId: CATEGORY.PLAYER,
				dependsOn: { key: "forceQualityEnabled" },
				options: [
					{ value: "highest", label: "Highest available" },
					{ value: "1080", label: "1080p" },
					{ value: "720", label: "720p" },
					{ value: "480", label: "480p" },
					{ value: "360", label: "360p" },
					{ value: "160", label: "160p" },
				],
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
				description: "Reduces stream latency by adjusting playback rate.",
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
				description: "The latency at which the playback rate will be speeded up to the minimum rate.",
				type: "number",
				categoryId: CATEGORY.LATENCY,
				requiresRefreshToDisable: true,
				dependsOn: { key: "streamLatencyReducerEnabled" },
				min: 0,
				step: 0.5,
				unit: "s",
			},
			{
				id: "streamLatencyReducerMaxThreshold",
				title: "Maximum Latency Threshold",
				description: "The latency at which the playback rate will be speeded up to the maximum rate.",
				type: "number",
				categoryId: CATEGORY.LATENCY,
				requiresRefreshToDisable: true,
				dependsOn: { key: "streamLatencyReducerEnabled" },
				min: 0,
				step: 0.5,
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
				id: "about",
				title: "About This Extension",
				description: "Information about the extension",
				type: "text",
				categoryId: CATEGORY.ABOUT,
				content: () => {
					return <EnhancerAboutComponent icons={brandIcons} platform="kick" workerService={workerService} />;
				},
				hideInfo: true,
			},
		];
	}

	private async run() {
		if (!this.settingsHelper) return;
		const settings = this.settingsHelper.loadSettings(KICK_DEFAULT_SETTINGS);
		const result = await this.settingsHelper.createSettingsContainer({
			defaults: settings,
			categories: this.SETTINGS_CATEGORIES,
			definitions: this.SETTING_DEFINITIONS,
			eventPrefix: "kick:settings:",
		});
		this.settingsSignal = result.settingsSignal;
		this.openSettingsFn = result.openSettings;
	}

	private loadSettings() {
		if (!this.settingsHelper) return;
		this.settingsHelper.loadSettings(KICK_DEFAULT_SETTINGS);
	}

	private openSettings() {
		this.openSettingsFn?.();
	}
}
