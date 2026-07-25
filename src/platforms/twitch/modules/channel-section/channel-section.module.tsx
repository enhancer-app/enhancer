import {
	type ChannelSectionAction,
	ChannelSectionComponent,
} from "$shared/components/channel-section/channel-section.component.tsx";
import type { TwitchPinnedStreamerSyncEvent } from "$types/platforms/twitch/twitch.events.types.ts";
import type { QuickAccessLink } from "$types/shared/components/settings.component.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import { type Signal, computed, signal } from "@preact/signals";
import { render } from "preact";
import TwitchModule from "../../twitch.module.ts";

export default class ChannelSectionModule extends TwitchModule {
	private quickAccessLinks = {} as Signal<QuickAccessLink[]>;
	private watchtimeCounter = {} as Signal<number>;
	private currentDisplayName = signal("");
	private currentLogin = signal("");
	private currentChannelId = signal("");
	private readonly settingsActionIcon = "⚙";
	private watchtimeInterval: NodeJS.Timeout | undefined;
	private pinnedStreamers = signal<string[]>([]);
	private pinnedStreamersEnabled = signal(false);
	private pinStreamerIcon = computed(() => (this.isPinnedStreamer(this.currentChannelId.value) ? "★" : "☆"));
	private pinStreamerTooltip = computed(() =>
		this.isPinnedStreamer(this.currentChannelId.value) ? "Unpin streamer" : "Pin streamer",
	);
	private headerActions = computed(() => this.getHeaderActions());

	readonly config: TwitchModuleConfig = {
		name: "channel-info",
		enabled: () => this.settings().channelSection,
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
				key: "pin-streamer-sync",
				event: "twitch:pinnedStreamer:sync",
				callback: this.syncPinnedStreamerAction.bind(this),
			},
			{
				type: "event",
				key: "pin-streamer-enabled-sync",
				event: "twitch:settings:pinnedStreamersEnabled",
				callback: (enabled) => {
					this.pinnedStreamersEnabled.value = enabled;
				},
			},
		],
	};

	initialize() {
		const quickAccessLinks = this.settings().quickAccessLinks;
		this.quickAccessLinks = signal(quickAccessLinks);
		this.pinnedStreamers.value = this.settings().pinnedStreamers;
		this.pinnedStreamersEnabled.value = this.settings().pinnedStreamersEnabled;
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
					actions={this.headerActions}
				/>,
				wrapper,
			);
		}
	}

	private getHeaderActions(): ChannelSectionAction[] {
		const actions: ChannelSectionAction[] = [];
		const channelId = this.currentChannelId.value;
		if (this.pinnedStreamersEnabled.value && channelId) {
			actions.push({
				key: "pin-streamer",
				icon: this.pinStreamerIcon,
				tooltip: this.pinStreamerTooltip,
				onClick: () => {
					const currentChannelId = this.currentChannelId.value;
					if (!currentChannelId) return;
					this.emitter.emit("twitch:pinnedStreamer:sync", {
						channelId: currentChannelId,
						isPinned: !this.isPinnedStreamer(currentChannelId),
						source: "channel-section",
					});
				},
			});
		}

		actions.push({
			key: "open-settings",
			icon: this.settingsActionIcon,
			tooltip: "Open Enhancer settings",
			onClick: () => {
				this.emitter.emit("extension:settings-open");
			},
		});
		return actions;
	}

	private getCurrentChannelByUrl() {
		const name = this.twitchUtils().getCurrentChannelByUrl();
		return { displayName: name, channelLogin: name, channelId: undefined };
	}

	private updateNames() {
		const channelInfo =
			this.twitchUtils().getChannelInfo() ||
			this.twitchUtils().getChannelInfoFromHomeLowerContent() ||
			this.getCurrentChannelByUrl();
		if (!channelInfo) {
			this.logger.warn("Channel name not found");
			return true;
		}
		this.currentDisplayName.value = channelInfo.displayName;
		this.currentLogin.value = channelInfo.channelLogin;
		this.currentChannelId.value =
			channelInfo.channelId ?? this.twitchUtils().getStreamInfo()?.channelID ?? this.twitchUtils().getChannelId() ?? "";
		return false;
	}

	private syncPinnedStreamerAction({ channelId, isPinned }: TwitchPinnedStreamerSyncEvent) {
		if (this.isPinnedStreamer(channelId) === isPinned) return;
		if (isPinned) {
			this.pinnedStreamers.value = [...this.pinnedStreamers.value, channelId];
		} else {
			this.pinnedStreamers.value = this.pinnedStreamers.value.filter((id) => id !== channelId);
		}
	}

	private isPinnedStreamer(channelId: string): boolean {
		return this.pinnedStreamers.value.includes(channelId);
	}

	private async updateWatchtime() {
		if (this.updateNames()) return;
		if (this.currentLogin.value.length < 1) return;
		try {
			this.watchtimeCounter.value = await this.getWatchTime(this.currentLogin.value);
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
			platform: "twitch",
			channel: channelName.toLowerCase(),
		});
		return watchtime?.time ?? 0;
	}
}
