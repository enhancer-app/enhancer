import { KICK_DEFAULT_SETTINGS } from "$kick/kick.constants.ts";
import KickModule from "$kick/kick.module.ts";
import { EnhancerAboutComponent } from "$shared/components/settings/about.component.tsx";
import Settings, { SettingsOverlay } from "$shared/components/settings/settings.component.tsx";
import type { KickSettings } from "$types/platforms/kick/kick.settings.types.ts";
import type { SettingDefinition, TabDefinition } from "$types/shared/components/settings.component.types.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";
import { type Signal, signal } from "@preact/signals";
import { render } from "preact";

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
				callback: this.openSettings.bind(this),
				key: "settings-open",
			},
		],
	};

	private SETTINGS_TABS: TabDefinition[] = [];
	private SETTING_DEFINITIONS: SettingDefinition<KickSettings>[] = [];

	private settingsSignal: Signal<KickSettings> = signal(KICK_DEFAULT_SETTINGS);
	private isOpenSignal: Signal<boolean> = signal(false);
	private settingsContainer: HTMLDivElement | null = null;
	private exposeSyncInterval: NodeJS.Timeout | null = null;

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
				id: "exposeFollowedToOthers",
				title: "Expose followed channels to other platforms",
				description: "Share your Kick followed list to Enhancer so it can be used on Twitch.",
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
				id: "realVideoTimeFormat12h",
				title: "Use 12-Hour Time Format",
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
			// {
			// 	id: "chatMessageMenuEnabled",
			// 	title: "Enable Chat Message Menu",
			// 	description: "Show a menu with message options when you right-click a chat message.",
			// 	type: "toggle",
			// 	tabIndex: 1,
			// },
			{
				id: "quickAccessLinks",
				title: "Quick Access Links",
				description: "Manage your quick access links with custom names and URLs",
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
		if (this.settingsSignal.value.exposeFollowedToOthers) {
			this.startExposeFollowedSync();
		}
	}

	private async loadSettings() {
		try {
			this.settingsSignal.value = { ...KICK_DEFAULT_SETTINGS, ...(await this.settingsService().getSettings()) };
		} catch (error) {
			console.error("Failed to load settings:", error);
		}
	}

	private async saveSettings(settings: KickSettings, updatedKey: keyof KickSettings) {
		try {
			await this.settingsService().updateSettings(settings);
			this.settingsSignal.value = settings;
			this.emitter.emit(`kick:settings:${updatedKey}`, settings[updatedKey]);
			this.logger.debug(`Settings changed "${updatedKey}" to`, settings[updatedKey]);
			if (updatedKey === "exposeFollowedToOthers") {
				if (settings.exposeFollowedToOthers) {
					this.startExposeFollowedSync();
				} else {
					this.stopExposeFollowedSync();
				}
			}
		} catch (error) {
			console.error("Failed to save settings:", error);
		}
	}

	private startExposeFollowedSync() {
		if (this.exposeSyncInterval) clearInterval(this.exposeSyncInterval);
		void this.syncFollowedToCommon();
		this.exposeSyncInterval = setInterval(() => void this.syncFollowedToCommon(), 5 * 60 * 1000);
	}

	private stopExposeFollowedSync() {
		if (this.exposeSyncInterval) {
			clearInterval(this.exposeSyncInterval);
			this.exposeSyncInterval = null;
		}
	}

	private extractKickUsernamesFromSidebar(): string[] {
		const sidebar = document.querySelector("#sidebar-wrapper");
		if (!sidebar) return [];
		const anchors = Array.from(sidebar.querySelectorAll("a"));
		const names = anchors
			.map((a) => {
				const href = (a as HTMLAnchorElement).href || (a as HTMLAnchorElement).getAttribute("href") || "";
				if (!href) return null;
				try {
					const url = new URL(href, window.location.origin);
					const parts = url.pathname.split("/").filter(Boolean);
					if (parts.length === 1) {
						return parts[0].toLowerCase();
					}
				} catch {}
				return null;
			})
			.filter((v): v is string => typeof v === "string");
		return Array.from(new Set(names));   //nicki z sidebara do wyjebania trzeba przez endpointa
	}

	private async syncFollowedToCommon() {
		try {
			const names = this.extractKickUsernamesFromSidebar();
			if (names.length === 0) return;
			await this.workerService().send("setCommon", {
				platform: "twitch",
				key: "kickStreamers",
				value: names,
			});
			this.logger.debug("Exposed Kick followed channels to common store (for Twitch)", names);
		} catch (error) {
			this.logger.warn("Failed to sync Kick followed channels:", error);
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
