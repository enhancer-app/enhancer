import { KICK_DEFAULT_SETTINGS } from "$kick/kick.constants.ts";
import KickModule from "$kick/kick.module.ts";
import {
	ACCOUNT_CATEGORY_ID,
	createAccountCategories,
	createAccountIdentity,
	createAccountSettings,
	createCosmeticsLink,
	createDeveloperCategories,
	createDeveloperSettings,
} from "$shared/module/helpers/enhancer-account-settings.tsx";
import { ExportImportComponent } from "$shared/components/export-import/export-import.component.tsx";
import { EnhancerAboutComponent } from "$shared/components/settings/about.component.tsx";
import { WatchtimeListComponent } from "$shared/components/watchtime-list/watchtime-list.component.tsx";
import {
	SETTING_SECTION,
	WATCHTIME_PERIOD_OPTIONS,
	channelSectionSetting,
	cosmeticsSettings,
	chatImagesSettings,
	followsSettings,
	latencySettings,
	pinnedStreamersSetting,
	quickAccessLinksSetting,
	realVideoTimeSettings,
} from "$shared/module/helpers/common-setting-definitions.ts";
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
	DATA: "data",
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
			{ id: CATEGORY.DATA, title: "Data", order: 6, placement: "utility" },
			{ id: CATEGORY.ABOUT, title: "About", order: 7, placement: "utility" },
			...createDeveloperCategories(8),
			...createAccountCategories(9),
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
			...realVideoTimeSettings(CATEGORY.GENERAL),
			pinnedStreamersSetting(CATEGORY.GENERAL),
			channelSectionSetting(CATEGORY.GENERAL),
			{
				id: "xayoWatchtimeEnabled",
				title: "Watchtime in user popups",
				description: "Shows watchtime from xayo.pl in Kick user popups.",
				type: "toggle",
				categoryId: CATEGORY.GENERAL,
				section: SETTING_SECTION.CHANNEL,
				tags: ["Enable Usercard Watchtime", "xayo"],
				requiresRefreshToDisable: true,
			},
			{
				id: "xayoWatchtimePeriod",
				title: "Time range",
				description: "The period used for user popup watchtime.",
				type: "select",
				categoryId: CATEGORY.GENERAL,
				tags: ["Xayo Watchtime Period"],
				dependsOn: { key: "xayoWatchtimeEnabled" },
				options: WATCHTIME_PERIOD_OPTIONS,
			},
			{
				id: "_disableExtensionOnDashboard",
				title: "Turn off on dashboard",
				description: "Enhancer won't load on dashboard.kick.com.",
				type: "toggle",
				categoryId: CATEGORY.GENERAL,
				section: SETTING_SECTION.ADVANCED,
				tags: ["Disable Enhancer on Dashboard"],
				requiresRefreshToDisable: true,
			},
			...chatImagesSettings(CATEGORY.CHAT),
			...cosmeticsSettings(CATEGORY.CHAT),
			...createCosmeticsLink(CATEGORY.CHAT),
			quickAccessLinksSetting(CATEGORY.CHANNEL, KICK_DEFAULT_SETTINGS.quickAccessLinks),
			{
				id: "forceQualityEnabled",
				title: "Force stream quality",
				description: "Starts streams at a fixed quality instead of Auto.",
				hint: "Higher quality means more delay and more buffering on a weak connection.",
				type: "toggle",
				categoryId: CATEGORY.PLAYER,
				requiresRefreshToDisable: true,
			},
			{
				id: "forceQualityPreferred",
				title: "Preferred quality",
				description:
					"The quality to pick on every stream. Falls back to the closest lower one when it's not available.",
				hint: "Source is skipped while you're logged out, because Kick only offers it to logged-in viewers.",
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
			...latencySettings(CATEGORY.LATENCY, { thresholdStep: 0.5 }),
			...followsSettings(CATEGORY.EXPERIMENTAL),
			{
				id: "watchtime-list",
				title: "Watchtime list",
				description: "How long you've watched each channel.",
				type: "text",
				categoryId: CATEGORY.DATA,
				content: () => {
					return <WatchtimeListComponent platform="kick" workerService={workerService} emitter={this.emitter} />;
				},
				hideInfo: true,
			},
			{
				id: "export-import",
				title: "Backup",
				description: "Export and import your settings and watchtime.",
				type: "text",
				categoryId: CATEGORY.DATA,
				tags: ["Export/Import Data"],
				content: () => {
					return <ExportImportComponent platform="kick" workerService={workerService} emitter={this.emitter} />;
				},
				hideInfo: true,
			},
			{
				id: "about",
				title: "About Enhancer",
				description: "Version, links and credits.",
				type: "text",
				categoryId: CATEGORY.ABOUT,
				content: () => {
					return <EnhancerAboutComponent icons={brandIcons} platform="kick" workerService={workerService} />;
				},
				hideInfo: true,
			},
			...createDeveloperSettings<KickSettings>(CATEGORY.ABOUT),
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
			identity: createAccountIdentity(this.workerService(), "kick"),
			identityCategoryId: ACCOUNT_CATEGORY_ID,
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
