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
	private previewAudio: HTMLAudioElement | null = null;

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
			...createAccountSettings("twitch", enhancerLogo),
			{
				id: "chattersEnabled",
				title: "Chatters counter",
				description: "Shows how many people are connected to chat, next to the viewer count.",
				type: "toggle",
				categoryId: CATEGORY.GENERAL,
				section: SETTING_SECTION.STREAM,
				tags: ["Enable Chatters Counter"],
				requiresRefreshToDisable: true,
			},
			...realVideoTimeSettings(CATEGORY.GENERAL),
			pinnedStreamersSetting(CATEGORY.GENERAL),
			{
				id: "hideStories",
				title: "Hide Stories",
				description: "Hides Stories and the Save Your Streak prompt in the left sidebar.",
				type: "toggle",
				categoryId: CATEGORY.GENERAL,
				section: SETTING_SECTION.SIDEBAR,
			},
			channelSectionSetting(CATEGORY.GENERAL),
			{
				id: "xayoWatchtimeEnabled",
				title: "Watchtime in usercards",
				description: "Shows watchtime from xayo.pl in usercards and in the /watchtime command.",
				hint: "Polish channels only.",
				type: "toggle",
				categoryId: CATEGORY.GENERAL,
				section: SETTING_SECTION.CHANNEL,
				tags: ["Enabled Usercard Watchtime", "xayo"],
				requiresRefreshToDisable: true,
			},
			{
				id: "xayoWatchtimePeriod",
				title: "Time range",
				description: "The period used for usercards and /watchtime.",
				type: "select",
				categoryId: CATEGORY.GENERAL,
				tags: ["Xayo Watchtime Period"],
				dependsOn: { key: "xayoWatchtimeEnabled" },
				options: WATCHTIME_PERIOD_OPTIONS,
			},
			...chatImagesSettings(CATEGORY.CHAT),
			{
				id: "chatMessageMenuEnabled",
				title: "Message menu",
				description: "Right-click a chat message to see more options.",
				type: "toggle",
				categoryId: CATEGORY.CHAT,
				section: SETTING_SECTION.MESSAGES,
				tags: ["Enable Chat Message Menu"],
			},
			{
				id: "chatMessageMenuUseAddInsteadOfSet",
				title: "Add to chat input",
				description: "Adds content to what you're typing instead of replacing it.",
				type: "toggle",
				categoryId: CATEGORY.CHAT,
				tags: ["Appending Content via Chat Message Menu"],
				dependsOn: { key: "chatMessageMenuEnabled" },
			},
			{
				id: "chatGiphyMessages",
				title: "Giphy messages",
				description: "What to do with Giphy messages in chat.",
				hint: "As link replaces the GIF with a text link. Changes apply to new messages; refresh the page to update older ones.",
				type: "choice",
				categoryId: CATEGORY.CHAT,
				section: SETTING_SECTION.MESSAGES,
				tags: ["Filter Giphy Messages", "Giphy Message Behavior", "gif"],
				options: [
					{ label: "Show", value: { chatHideGiphyMessages: false } },
					{ label: "Hide", value: { chatHideGiphyMessages: true, chatGiphyMessageMode: "hide" } },
					{ label: "As link", value: { chatHideGiphyMessages: true, chatGiphyMessageMode: "link" } },
				],
			},
			...cosmeticsSettings(CATEGORY.CHAT),
			...createCosmeticsLink(CATEGORY.CHAT),
			{
				id: "chatMentionSoundEnabled",
				title: "Mention sound",
				description: "Plays a sound when someone mentions you in chat.",
				type: "toggle",
				categoryId: CATEGORY.CHAT,
				section: SETTING_SECTION.NOTIFICATIONS,
				tags: ["Enable Chat Mention Sound"],
			},
			{
				id: "chatMentionSoundFile",
				title: "Custom sound",
				description: "Upload your own audio file, or leave empty for the default sound.",
				type: "file",
				categoryId: CATEGORY.CHAT,
				tags: ["Custom Mention Sound File"],
				validTypes: ["audio/mpeg", "audio/mp3", "audio/ogg", "audio/wav", "audio/webm", "audio/aac", "audio/flac"],
				fileNameKey: "chatMentionSoundFileName",
				uploadedLabel: "Custom sound",
				dependsOn: { key: "chatMentionSoundEnabled" },
			},
			{
				id: "chatMentionSoundVolume",
				title: "Volume",
				description: "Press ▶ to hear how loud it is.",
				type: "number",
				min: 0,
				max: 100,
				step: 1,
				unit: "%",
				slider: true,
				onPreview: (settings) => void this.previewMentionSound(settings),
				previewLabel: "Play mention sound",
				categoryId: CATEGORY.CHAT,
				tags: ["Mention Sound Volume"],
				dependsOn: { key: "chatMentionSoundEnabled" },
			},
			quickAccessLinksSetting(CATEGORY.CHANNEL, TWITCH_DEFAULT_SETTINGS.quickAccessLinks),
			...latencySettings(CATEGORY.LATENCY, {
				reducerHint: "Works only with Low Latency Mode turned on.",
				thresholdStep: 1,
			}),
			...followsSettings(CATEGORY.EXPERIMENTAL),
			{
				id: "emoteBarEnabled",
				title: "Emote bar",
				description: "Shows your most used emotes for this channel above the chat input.",
				hint: "Click to insert, Ctrl+Click to send, right-click twice to remove.",
				type: "toggle",
				categoryId: CATEGORY.EXPERIMENTAL,
				tags: ["Enable Emote Bar"],
				requiresRefreshToDisable: true,
			},
			{
				id: "watchtime-list",
				title: "Watchtime list",
				description: "How long you've watched each channel.",
				type: "text",
				categoryId: CATEGORY.DATA,
				content: () => {
					return <WatchtimeListComponent platform="twitch" workerService={workerService} emitter={this.emitter} />;
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
					return <ExportImportComponent platform="twitch" workerService={workerService} emitter={this.emitter} />;
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
					return <EnhancerAboutComponent icons={brandIcons} platform="twitch" workerService={workerService} />;
				},
				hideInfo: true,
			},
			...createDeveloperSettings<TwitchSettings>(CATEGORY.ABOUT),
		];
	}

	private async previewMentionSound(settings: TwitchSettings) {
		const file = settings.chatMentionSoundFile;
		const legacyUrl = settings.chatMentionSoundSource;
		const source = file?.startsWith("data:")
			? file
			: legacyUrl && legacyUrl.length > 3 && this.commonUtils().isValidUrl(legacyUrl)
				? legacyUrl
				: await this.commonUtils().getAssetFile(this.workerService(), "modules/mention-sound.ogg", "");
		if (!source) return;
		this.previewAudio?.pause();
		this.previewAudio = new Audio(source);
		this.previewAudio.volume = (settings.chatMentionSoundVolume ?? 50) / 100;
		this.previewAudio.play().catch((error) => this.logger.warn("Failed to preview mention sound:", error));
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
