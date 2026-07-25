import KickModule from "$kick/kick.module.ts";
import {
	type ChannelSectionAction,
	ChannelSectionComponent,
} from "$shared/components/channel-section/channel-section.component.tsx";
import type { QuickAccessLink } from "$types/shared/components/settings.component.types.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";
import { type Signal, signal } from "@preact/signals";
import { render } from "preact";

export default class ChannelSectionModule extends KickModule {
	private quickAccessLinks = {} as Signal<QuickAccessLink[]>;
	private watchtimeCounter = {} as Signal<number>;
	private currentUsername = signal("");
	private readonly settingsActionIcon = "⚙";
	private watchtimeInterval: NodeJS.Timeout | undefined;

	readonly config: KickModuleConfig = {
		name: "channel-info",
		enabled: () => this.settings().channelSection,
		appliers: [
			{
				type: "selector",
				key: "channel-info",
				selectors: ["#channel-content section.rounded-lg"],
				callback: this.run.bind(this),
				useParent: true,
				once: true,
			},
			{
				type: "event",
				key: "settings-quick-access-links",
				event: "kick:settings:quickAccessLinks",
				callback: (quickAccessLinks) => {
					this.quickAccessLinks.value = quickAccessLinks;
				},
			},
		],
	};

	async initialize() {
		const quickAccessLinks = this.settings().quickAccessLinks;
		this.quickAccessLinks = signal(quickAccessLinks);
	}

	private async run(elements: Element[]) {
		elements.forEach((element) => {
			(element as HTMLElement).style.flexDirection = "column";
		});
		const wrappers = this.commonUtils().createEmptyElements(this.getId(), elements, "div");
		for (const wrapper of wrappers) {
			const channelName = this.kickUtils().getChannelInfo()?.slug;
			if (!channelName) {
				this.logger.warn("Channel name not found");
				continue;
			}
			this.currentUsername.value = channelName;
			await this.startWatchtimeUpdates();
			const logo = await this.commonUtils().getAssetFile(
				this.workerService(),
				"enhancer/logo.svg",
				"https://enhancer.at/assets/brand/logo.png",
			);
			render(
				<ChannelSectionComponent
					displayName={this.currentUsername}
					login={this.currentUsername}
					sites={this.quickAccessLinks}
					watchTime={this.watchtimeCounter}
					logoUrl={logo}
					actions={this.getHeaderActions()}
				/>,
				wrapper,
			);
		}
	}

	private getHeaderActions(): ChannelSectionAction[] {
		return [
			{
				key: "open-settings",
				icon: this.settingsActionIcon,
				tooltip: "Open Enhancer settings",
				onClick: () => {
					this.emitter.emit("extension:settings-open");
				},
			},
		];
	}

	private async updateWatchtime() {
		if (this.currentUsername.value.length < 1) return;
		try {
			this.watchtimeCounter.value = await this.getWatchTime(this.currentUsername.value);
		} catch (error) {
			this.logger.error("Failed to fetch watch time:", error);
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
			platform: "kick",
			channel: channelName.toLowerCase(),
		});
		return watchtime?.time ?? 0;
	}
}
