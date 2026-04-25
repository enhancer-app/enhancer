import {
	type ChannelSectionAction,
	ChannelSectionComponent,
} from "$shared/components/channel-section/channel-section.component.tsx";
import type {
	PinStreamerRequestResult,
	PinStreamerStateChangedEvent,
} from "$types/platforms/twitch/twitch.events.types.ts";
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
	private isCurrentChannelPinned = signal(false);
	private pinActionIcon = signal("☆");
	private pinActionTooltip = signal("Pin streamer");
	private settingsActionIcon = signal("⚙");
	private currentChannelId = "";
	private lastPinStatusKey = "";
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
			{
				type: "event",
				key: "pin-streamer-state-changed",
				event: "twitch:pin-streamer-state-changed",
				callback: this.onPinStreamerStateChanged.bind(this),
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
			await this.syncChannelState();
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
					actions={this.getHeaderActions()}
				/>,
				wrapper,
			);
		}
	}

	private getHeaderActions(): ChannelSectionAction[] {
		return [
			{
				key: "pin-streamer",
				icon: this.pinActionIcon,
				tooltip: this.pinActionTooltip,
				isPressed: this.isCurrentChannelPinned,
				onClick: () => {
					void this.toggleCurrentStreamerPin();
				},
			},
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

	private resolveCurrentChannelId(): string | undefined {
		const followedChannelId = this.resolveCurrentChannelIdFromFollowList();
		if (followedChannelId) return followedChannelId;
		const channelInfo = this.twitchUtils().getChannelInfoFromHomeLowerContent();
		if (channelInfo?.channelId) return channelInfo.channelId;
		const channelId = this.twitchUtils().getChannelId();
		if (!channelId || channelId.length < 1) return;
		return channelId;
	}

	private resolveCurrentChannelIdFromFollowList(): string | undefined {
		const currentLogin = this.currentLogin.value.toLowerCase();
		if (currentLogin.length < 1) return;
		const sections = this.twitchUtils().getPersonalSections()?.props?.section;
		if (!sections) return;
		const allItems = [...(sections.streams ?? []), ...(sections.offlineChannels ?? [])] as unknown as Array<{
			user?: { id?: string; login?: string | number };
		}>;
		const item = allItems.find((entry) => String(entry.user?.login ?? "").toLowerCase() === currentLogin);
		if (!item?.user?.id) return;
		return item.user.id;
	}

	private async requestPinStatus(channelId: string): Promise<PinStreamerRequestResult | undefined> {
		return await new Promise<PinStreamerRequestResult | undefined>((resolve) => {
			let completed = false;
			const timeout = setTimeout(() => {
				if (completed) return;
				completed = true;
				resolve(undefined);
			}, 700);
			this.emitter.emit("twitch:pin-streamer-request", {
				action: "status",
				channelId,
				trackCurrent: true,
				onResult: (result) => {
					if (completed) return;
					completed = true;
					clearTimeout(timeout);
					resolve(result);
				},
			});
		});
	}

	private setPinActionState(isPinned: boolean) {
		this.isCurrentChannelPinned.value = isPinned;
		this.pinActionIcon.value = isPinned ? "★" : "☆";
		this.pinActionTooltip.value = isPinned ? "Unpin streamer" : "Pin streamer";
	}

	private async refreshPinStatus(channelId = this.resolveCurrentChannelId()) {
		if (!channelId) {
			this.currentChannelId = "";
			this.setPinActionState(false);
			return;
		}
		this.currentChannelId = channelId;
		const result = await this.requestPinStatus(channelId);
		if (!result || result.status === "failed") {
			return;
		}
		const resultPinned = result.signal?.value ?? result.isPinned;
		if (result.status === "module_disabled") {
			this.isCurrentChannelPinned.value = resultPinned ?? this.isCurrentChannelPinned.value;
			this.pinActionTooltip.value = "Pinning unavailable (module disabled)";
			this.pinActionIcon.value = (resultPinned ?? this.isCurrentChannelPinned.value) ? "★" : "☆";
			return;
		}
		if (resultPinned !== undefined) {
			this.setPinActionState(resultPinned);
			return;
		}
		if (result.status === "already_pinned" || result.status === "pinned") {
			this.setPinActionState(true);
			return;
		}
		if (result.status === "not_pinned") {
			this.setPinActionState(false);
		}
	}

	private onPinStreamerStateChanged(event: PinStreamerStateChangedEvent) {
		const currentChannelId = this.currentChannelId || this.resolveCurrentChannelId();
		if (!currentChannelId || event.channelId !== currentChannelId) return;
		this.currentChannelId = currentChannelId;
		this.setPinActionState(event.signal.value);
	}

	private async toggleCurrentStreamerPin() {
		const channelId = this.resolveCurrentChannelId();
		if (!channelId) return;
		this.currentChannelId = channelId;
		const action = this.isCurrentChannelPinned.value ? "unpin" : "pin";
		await new Promise<void>((resolve) => {
			let completed = false;
			const timeout = setTimeout(() => {
				if (completed) return;
				completed = true;
				resolve();
			}, 700);
			this.emitter.emit("twitch:pin-streamer-request", {
				action,
				channelId,
				trackCurrent: true,
				onResult: (result) => {
					if (completed) return;
					completed = true;
					clearTimeout(timeout);
					const resultPinned = result.signal?.value ?? result.isPinned;
					if (resultPinned !== undefined) {
						this.setPinActionState(resultPinned);
					} else if (result.status === "already_pinned" || result.status === "pinned") {
						this.setPinActionState(true);
					} else if (result.status === "not_pinned") {
						this.setPinActionState(false);
					}
					resolve();
				},
			});
		});
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
		if (this.currentLogin.value.length < 1) return;
		try {
			this.watchtimeCounter.value = await this.getWatchTime(this.currentLogin.value);
		} catch (error) {
			console.error("Failed to fetch watch time:", error);
		}
	}

	private async syncChannelState() {
		if (this.updateNames()) return;
		if (this.currentLogin.value.length < 1) return;
		const channelId = this.resolveCurrentChannelId();
		const pinStatusKey = `${this.currentLogin.value}:${channelId ?? ""}`;
		if (this.lastPinStatusKey !== pinStatusKey) {
			this.lastPinStatusKey = pinStatusKey;
			await this.refreshPinStatus(channelId);
		}
	}

	public async startWatchtimeUpdates() {
		if (!("value" in this.watchtimeCounter)) {
			this.watchtimeCounter = signal(0);
		}
		if (this.watchtimeInterval) {
			clearInterval(this.watchtimeInterval);
		}
		await this.syncChannelState();
		await this.updateWatchtime();
		this.watchtimeInterval = setInterval(async () => {
			await this.syncChannelState();
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
