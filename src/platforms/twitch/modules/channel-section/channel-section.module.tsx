import { ChannelSectionComponent } from "$shared/components/channel-section/channel-section.component.tsx";
import type { QuickAccessLink } from "$types/shared/components/settings.component.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import { type Signal, signal } from "@preact/signals";
import { render } from "preact";
import TwitchModule from "../../twitch.module.ts";

export default class ChannelSectionModule extends TwitchModule {
	private quickAccessLinks = {} as Signal<QuickAccessLink[]>;
	private watchtimeCounter = {} as Signal<number>;
	private currentDisplayName = signal("");
	private currentLogin = signal("");
	private watchtimeInterval: NodeJS.Timeout | undefined;
	private pinnedStreamers: string[] = [];
	private channelId: string | undefined;
	private isPinned: Signal<boolean> | undefined;

	readonly config: TwitchModuleConfig = {
		name: "channel-info",
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
			{
				type: "event",
				key: "pinned-streamers-updated",
				event: "twitch:pinnedStreamersUpdated",
				callback: (pinned: string[]) => {
					this.pinnedStreamers = [...pinned];
				},
			},
		],
	};

	async initialize() {
		const quickAccessLinks = await this.settingsService().getSettingsKey("quickAccessLinks");
		this.quickAccessLinks = signal(quickAccessLinks);
		this.pinnedStreamers.push(...(await this.settingsService().getSettingsKey("pinnedStreamers")));
	}

	private async run(elements: Element[]) {
		const wrappers = this.commonUtils().createEmptyElements(this.getId(), elements, "div");
		for (const wrapper of wrappers) {
			if (await this.updateNames()) continue;
			await this.startWatchtimeUpdates();
			const logo = await this.commonUtils().getAssetFile(
				this.workerService(),
				"enhancer/logo.svg",
				"https://enhancer.at/assets/brand/logo.png",
			);
			const pinnedEnabled = await this.settingsService().getSettingsKey("pinnedStreamersEnabled");
			this.channelId = await this.getChannelId();
			this.isPinned = signal(!!(pinnedEnabled && this.channelId && this.isPinnedStreamer(this.channelId)));
			render(
				<ChannelSectionComponent
					displayName={this.currentDisplayName}
					login={this.currentLogin}
					sites={this.quickAccessLinks}
					watchTime={this.watchtimeCounter}
					logoUrl={logo}
					isPinned={pinnedEnabled && this.channelId ? this.isPinned : undefined}
					onTogglePin={
						pinnedEnabled && this.channelId
							? async () => {
									const channelId = this.channelId;
									const isPinned = this.isPinned;
									if (!channelId || !isPinned) return;
									isPinned.value = await this.togglePinnedStreamer(channelId);
								}
							: undefined
					}
				/>,
				wrapper,
			);
		}
	}

	private async updateNames() {
		const channelInfo = this.twitchUtils().getChannelInfo() || this.twitchUtils().getChannelInfoFromHomeLowerContent();
		if (!channelInfo) {
			this.logger.warn("Channel name not found");
			return true;
		}
		this.currentDisplayName.value = channelInfo.displayName;
		this.currentLogin.value = channelInfo.channelLogin;
		try {
			this.channelId = this.twitchUtils().getChannelId();
			if (this.isPinned) {
				const pinnedEnabled = await this.settingsService().getSettingsKey("pinnedStreamersEnabled");
				this.isPinned.value = !!(pinnedEnabled && this.channelId && this.isPinnedStreamer(this.channelId));
			}
		} catch {
			this.logger.error("Failed to get channel ID");
		}
		return false;
	}

	private async updateWatchtime() {
		if (await this.updateNames()) return;
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

	private async getChannelId(): Promise<string | undefined> {
		let resolvedId: string | undefined;
		await this.commonUtils().waitFor(
			() => {
				try {
					const direct = this.twitchUtils().getChannelId();
					if (direct) return direct;
					const alt = this.twitchUtils().getChannelInfoFromHomeLowerContent();
					return alt?.channelId;
				} catch {
					return undefined;
				}
			},
			async (id) => {
				resolvedId = id;
				return true;
			},
			{ maxRetries: 50, delay: 100 },
		);
		return resolvedId;
	}

	private isPinnedStreamer(channelId: string): boolean {
		return this.pinnedStreamers.includes(channelId);
	}

	private async togglePinnedStreamer(channelId: string): Promise<boolean> {
		const isPinned = this.isPinnedStreamer(channelId);
		if (isPinned) {
			this.pinnedStreamers = this.pinnedStreamers.filter((id) => id !== channelId);
		} else {
			this.pinnedStreamers.push(channelId);
		}
		await this.settingsService().updateSettingsKey("pinnedStreamers", this.pinnedStreamers);
		this.twitchUtils().getPersonalSections()?.forceUpdate();
		this.emitter.emit("twitch:pinnedStreamersUpdated", this.pinnedStreamers);
		return !isPinned;
	}
}
