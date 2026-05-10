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
	private pinnedStreamers: string[] = [];
	private pinnedStreamersEnabled = signal(false);
	private pinnedStreamerActionsByChannelId = new Map<string, PinnedStreamerActionState>();
	private headerActions = computed(() => this.getHeaderActions());

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

	async initialize() {
		const quickAccessLinks = await this.settingsService().getSettingsKey("quickAccessLinks");
		this.quickAccessLinks = signal(quickAccessLinks);
		this.pinnedStreamers = await this.settingsService().getSettingsKey("pinnedStreamers");
		this.pinnedStreamersEnabled.value = await this.settingsService().getSettingsKey("pinnedStreamersEnabled");
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
			const pinnedStreamerAction = this.getPinnedStreamerAction(channelId);
			actions.push({
				key: "pin-streamer",
				icon: pinnedStreamerAction.icon,
				tooltip: pinnedStreamerAction.tooltip,
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

	private updateNames() {
		const channelInfo = this.twitchUtils().getChannelInfo() || this.twitchUtils().getChannelInfoFromHomeLowerContent();
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

	private getPinnedStreamerAction(channelId: string): PinnedStreamerActionState {
		const existingAction = this.pinnedStreamerActionsByChannelId.get(channelId);
		if (existingAction) {
			this.updatePinnedStreamerAction(channelId, this.isPinnedStreamer(channelId));
			return existingAction;
		}

		const action = {
			icon: signal(""),
			tooltip: signal(""),
		};
		this.pinnedStreamerActionsByChannelId.set(channelId, action);
		this.updatePinnedStreamerAction(channelId, this.isPinnedStreamer(channelId));
		return action;
	}

	private syncPinnedStreamerAction({ channelId, isPinned }: TwitchPinnedStreamerSyncEvent) {
		if (!this.pinnedStreamersEnabled.value) return;
		if (this.isPinnedStreamer(channelId) === isPinned) {
			this.updatePinnedStreamerAction(channelId, isPinned);
			return;
		}
		if (isPinned) {
			this.pinnedStreamers.push(channelId);
		} else {
			this.pinnedStreamers = this.pinnedStreamers.filter((id) => id !== channelId);
		}
		this.updatePinnedStreamerAction(channelId, isPinned);
	}

	private updatePinnedStreamerAction(channelId: string, isPinned: boolean) {
		const action = this.pinnedStreamerActionsByChannelId.get(channelId);
		if (!action) return;
		action.icon.value = isPinned ? "★" : "☆";
		action.tooltip.value = isPinned ? "Unpin streamer" : "Pin streamer";
	}

	private isPinnedStreamer(channelId: string): boolean {
		return this.pinnedStreamers.includes(channelId);
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

type PinnedStreamerActionState = {
	icon: Signal<string>;
	tooltip: Signal<string>;
};
