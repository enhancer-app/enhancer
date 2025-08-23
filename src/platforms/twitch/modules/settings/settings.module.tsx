import { EnhancerAboutComponent } from "$shared/components/settings/about.component.tsx";
import Settings, { SettingsOverlay } from "$shared/components/settings/settings.component.tsx";
import { TWITCH_DEFAULT_SETTINGS } from "$twitch/twitch.constants.ts";
import TwitchModule from "$twitch/twitch.module.ts";
import type { TwitchSettings } from "$types/platforms/twitch/twitch.settings.types.ts";
import type { SettingDefinition, TabDefinition } from "$types/shared/components/settings.component.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import { type Signal, signal } from "@preact/signals";
import { render } from "preact";

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
				callback: this.openSettings.bind(this),
				key: "settings-open",
			},
		],
	};

	private SETTINGS_TABS: TabDefinition[] = [];
	private SETTING_DEFINITIONS: SettingDefinition<TwitchSettings>[] = [];

	private settingsSignal: Signal<TwitchSettings> = signal(TWITCH_DEFAULT_SETTINGS);
	private isOpenSignal: Signal<boolean> = signal(false);
	private settingsContainer: HTMLDivElement | null = null;

	async initialize() {
		this.SETTINGS_TABS = [
			{
				title: "General",
				iconUrl: await this.commonUtils().getAssetFile(this.workerService(), "settings/general.svg"),
			},
			{
				title: "Chat",
				iconUrl: await this.commonUtils().getAssetFile(this.workerService(), "settings/chat.svg"),
			},
			{
				title: "Channel",
				iconUrl: await this.commonUtils().getAssetFile(this.workerService(), "settings/channel.svg"),
			},
			{
				title: "About",
				iconUrl: await this.commonUtils().getAssetFile(this.workerService(), "settings/about.svg"),
			},
		];
		const brandIcons = {
			website: await this.commonUtils().getAssetFile(this.workerService(), "brands/website.svg"),
			github: await this.commonUtils().getAssetFile(this.workerService(), "brands/github.svg"),
			twitter: await this.commonUtils().getAssetFile(this.workerService(), "brands/twitter.svg"),
			discord: await this.commonUtils().getAssetFile(this.workerService(), "brands/discord.svg"),
		};
		this.SETTING_DEFINITIONS = [
			{
				id: "showFollowsFromOtherPlatforms",
				title: "Enable follow list from other platforms",
				description: "Shows your followed channels from other platforms in the follow list.",
				type: "toggle",
				tabIndex: 0,
				requiresRefreshToDisable: true,
			},
			{
				id: "shareFollowsToOtherPlatforms",
				title: "Share followed channels",
				description: "Expose your followed list to Enhancer so it can be used across platforms.",
				type: "toggle",
				tabIndex: 0,
				requiresRefreshToDisable: false,
			},
			{
				id: "streamLatencyEnabled",
				title: "Enable Stream Latency",
				description: "Shows the current stream delay on top of the chat.",
				type: "toggle",
				tabIndex: 0,
				requiresRefreshToDisable: true,
			},
			{
				id: "realVideoTimeEnabled",
				title: "Enable Real Video Time",
				description: "Displays the real-world time of the VOD.",
				type: "toggle",
				tabIndex: 0,
				requiresRefreshToDisable: true,
			},
			{
				id: "pinnedStreamersEnabled",
				title: "Enable Pinning Streamers",
				description: "Allows you to pin your favorite streamers for easy access.",
				type: "toggle",
				tabIndex: 0,
				requiresRefreshToDisable: true,
			},
			{
				id: "xayoWatchtimeEnabled",
				title: "Enabled Usercard Watchtime",
				description:
					"Displays watchtime in usercards and via the /watchtime command for Polish channels by xayo.pl service.",
				type: "toggle",
				tabIndex: 0,
				requiresRefreshToDisable: true,
			},
			{
				id: "realVideoTimeFormat12h",
				title: "12-Hour Time Format",
				description: "Display real video time in 12-hour format (AM/PM) instead of 24-hour format.",
				type: "toggle",
				tabIndex: 0,
			},
			{
				id: "chatImagesEnabled",
				title: "Enable Chat Images",
				description: "Display images sent in chat messages.",
				type: "toggle",
				confirmOnEnable: true,
				confirmationMessage:
					"Enhancer is not responsible for the content of images sent in the chat by users. By enabling this option, you can see images in the chat that may not look good. We do not moderate them in any way, we simply display them. Are you sure you want to enable this option?",
				tabIndex: 1,
			},
			{
				id: "chatImagesOnHover",
				title: "Show Images on Hover",
				description: "Images are hidden until you hover your mouse to reveal them.",
				type: "toggle",
				tabIndex: 1,
			},
			{
				id: "chatImagesSize",
				title: "Chat Image Size",
				description: "Maximum size of images allowed in chat messages (in megabytes).",
				type: "number",
				tabIndex: 1,
				min: 1,
				step: 1,
			},
			{
				id: "chatBadgesEnabled",
				title: "Enable Chat Badges",
				description: "Show custom chat badges from Enhancer extension.",
				type: "toggle",
				tabIndex: 1,
			},
			{
				id: "chatNicknameCustomizationEnabled",
				title: "Enable Nickname Customization",
				description: "Show custom chat nickname customizations from Enhancer extension in chat.",
				type: "toggle",
				tabIndex: 1,
			},
			{
				id: "chatMessageMenuEnabled",
				title: "Enable Chat Message Menu",
				description: "Show a menu with message options when you right-click a chat message.",
				type: "toggle",
				tabIndex: 1,
			},
			{
				id: "chatMessageMenuUseAddInsteadOfSet",
				title: "Appending Content via Chat Message Menu",
				description:
					"When using the chat message menu, new content will be added to the message in chat input instead of replacing it.",
				type: "toggle",
				tabIndex: 1,
			},
			{
				id: "chatMentionSoundEnabled",
				title: "Enable Chat Mention Sound",
				description: "Turn on to receive a sound notification when someone mentions you in chat.",
				type: "toggle",
				tabIndex: 1,
			},
			{
				id: "chatMentionSoundSource",
				title: "Custom Mention Sound URL",
				description:
					"Set a custom audio file to play when you are mentioned in chat. Leave it empty for default sound.",
				type: "input",
				tabIndex: 1,
			},
			{
				id: "chatMentionSoundVolume",
				title: "Custom Mention Sound",
				description: "Adjust the volume level for your mention notification sound.",
				type: "number",
				min: 0,
				max: 100,
				step: 1,
				tabIndex: 1,
			},
			{
				id: "quickAccessLinks",
				title: "Quick Access Links",
				description:
					"Manage your quick access links. Use %username% in the URL to dynamically include the streamer's name.",
				type: "array",
				tabIndex: 2,
				arrayItemFields: [
					{ name: "title", placeholder: "Enter link name..." },
					{ name: "url", placeholder: "Enter URL..." },
				],
			},
			{
				id: "about",
				title: "About This Extension",
				description: "Information about the extension",
				type: "text",
				tabIndex: 3,
				content: () => {
					return <EnhancerAboutComponent icons={brandIcons} />;
				},
				hideInfo: true,
			},
		];
	}

	private async run() {
		await this.loadSettings();
		await this.createSettingsContainer();
		this.setupKeyboardShortcut();
		// syncing handled by ExposeFollowsModule
	}

	private async loadSettings() {
		try {
			const settings = await this.workerService().send("getSettings", {
				platform: "twitch",
			});
			if (!settings) throw Error("Failed to load settings from worker");
			this.settingsSignal.value = { ...TWITCH_DEFAULT_SETTINGS, ...settings };
		} catch (error) {
			console.error("Failed to load settings:", error);
		}
	}

	private async saveSettings(settings: TwitchSettings, updatedKey: keyof TwitchSettings) {
		try {
			await this.workerService().send("updateSettings", { settings, platform: "twitch" });
			this.settingsSignal.value = settings;
			this.emitter.emit(`twitch:settings:${updatedKey}`, settings[updatedKey]);
			this.logger.debug(`Settings changed "${updatedKey}" to`, settings[updatedKey]);
		} catch (error) {
			console.error("Failed to save settings:", error);
		}
	}

	private async createSettingsContainer() {
		const wrapper = this.commonUtils().createElementByParent(
			"enhancer-settings",
			"div",
			document.body,
		) as HTMLDivElement;
		this.settingsContainer = wrapper as HTMLDivElement;
		const logo = await this.commonUtils().getAssetFile(
			this.workerService(),
			"enhancer/logo.svg",
			"https://enhancer.at/assets/brand/logo.png",
		);
		const renderSettings = () => {
			if (this.settingsContainer) {
				render(
					<SettingsOverlay style={{ display: this.isOpenSignal.value ? "flex" : "none" }}>
						<Settings
							logoSrc={logo}
							tabs={this.SETTINGS_TABS}
							settingDefinitions={this.SETTING_DEFINITIONS}
							settings={this.settingsSignal.value}
							onSettingsChange={(newSettings, updatedKey) => this.saveSettings(newSettings, updatedKey)}
							onClose={() => this.closeSettings()}
						/>
					</SettingsOverlay>,
					this.settingsContainer,
				);
			}
		};
		renderSettings();

		this.isOpenSignal.subscribe(renderSettings);
		this.settingsSignal.subscribe(renderSettings);
	}

	private setupKeyboardShortcut() {
		document.addEventListener("keydown", (e) => {
			if (e.key === "Escape" && this.isOpenSignal.value) {
				this.closeSettings();
			}
		});
	}

	private openSettings() {
		this.isOpenSignal.value = true;
	}

	private closeSettings() {
		this.isOpenSignal.value = false;
	}
}
