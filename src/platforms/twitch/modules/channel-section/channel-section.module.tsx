import { type Signal, signal } from "@preact/signals";
import { render } from "preact";
import styled from "styled-components";
import { ChannelSectionComponent } from "$shared/components/channel-section/channel-section.component.tsx";
import type { QuickAccessLink } from "$types/shared/components/settings.component.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import TwitchModule from "../../twitch.module.ts";

export default class ChannelSectionModule extends TwitchModule {
	private quickAccessLinks = {} as Signal<QuickAccessLink[]>;
	private watchtimeCounter = {} as Signal<number>;
	private currentDisplayName = signal("");
	private currentLogin = signal("");
	private watchtimeInterval: NodeJS.Timeout | undefined;

	readonly config: TwitchModuleConfig = {
		name: "channel-info",
		isModuleEnabledCallback: async () => this.settingsService().getSettingsKey("channelSection"),
		appliers: [
			{
				type: "selector",
				key: "channel-info",
				selectors: [".about-section__panel"],
				callback: this.run.bind(this),
				once: true,
			},
			{
				type: "event",
				key: "settings-quick-access-links",
				event: "twitch:settings:quickAccessLinks",
				callback: (quickAccessLinks) => {
					this.quickAccessLinks.value = quickAccessLinks;
				},
			},
		],
	};

	async initialize() {
		const quickAccessLinks = await this.settingsService().getSettingsKey("quickAccessLinks");
		this.quickAccessLinks = signal(quickAccessLinks);
	}

	private async run(elements: Element[]) {
		const wrappers = this.commonUtils().createEmptyElements(this.getId(), elements, "div");
		for (const wrapper of wrappers) {
			if (this.updateNames()) continue;
			await this.startWatchtimeUpdates();
			const logo = await this.commonUtils().getAssetFile(
				this.workerService(),
				"enhancer/logo.svg",
				"https://enhancer.at/assets/brand/logo.png",
			);
			render(
				<ChannelSectionComponent
					displayName={this.currentDisplayName}
					login={this.currentLogin}
					sites={this.quickAccessLinks}
					watchTime={this.watchtimeCounter}
					logoUrl={logo}
				/>,
				wrapper,
			);
		}
	}

	private updateNames() {
		const channelInfo = this.twitchUtils().getChannelInfo() || this.twitchUtils().getChannelInfoFromHomeLowerContent();
		if (!channelInfo) {
			this.logger.warn("Channel name not found");
			return true;
		}
		this.currentDisplayName.value = channelInfo.displayName;
		this.currentLogin.value = channelInfo.channelLogin;
		return false;
	}

	private async updateWatchtime() {
		if (this.updateNames()) return;
		if (this.currentLogin.value.length < 1) return;
		try {
			this.watchtimeCounter.value = await this.getWatchTime(this.currentLogin.value);
		} catch (error) {
			console.error("Failed to fetch watch time:", error);
		}
	}

	public async startWatchtimeUpdates() {
		if (!("value" in this.watchtimeCounter)) {
			this.watchtimeCounter = signal(0);
		}
		if (this.watchtimeInterval) {
			clearInterval(this.watchtimeInterval);
		}
		await this.updateWatchtime();
		this.watchtimeInterval = setInterval(async () => {
			await this.updateWatchtime();
		}, 1000);
	}

	private async getWatchTime(channelName: string): Promise<number> {
		const watchtime = await this.workerService().send("getWatchtime", {
			platform: "twitch",
			channel: channelName.toLowerCase(),
		});
		return watchtime?.time ?? 0;
	}
}
