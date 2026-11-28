import {
	type ChannelSectionAction,
	ChannelSectionComponent,
} from "$shared/components/channel-section/channel-section.component.tsx";
import { ChannelPinsHelper } from "$shared/module/helpers/channel-pins.helper.ts";
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
	private watchtimeLogin = "";
	private watchtimeFetchedAt = 0;
	private static readonly WATCHTIME_REFRESH_MS = 5000;
	private pins!: ChannelPinsHelper;
	private pinnedStreamersEnabled = signal(false);
	private pinStreamerIcon = computed(() => (this.isPinnedStreamer(this.currentLogin.value) ? "★" : "☆"));
	private pinStreamerTooltip = computed(() =>
		this.isPinnedStreamer(this.currentLogin.value) ? "Unpin streamer" : "Pin streamer",
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
				key: "pin-streamer-enabled-sync",
				event: "global:settings:pinnedStreamersEnabled",
				callback: (enabled) => {
					this.pinnedStreamersEnabled.value = enabled;
				},
			},
			{
				type: "event",
				key: "pin-streamer-settings-refresh",
				event: "extension:settings-refresh",
				callback: () => {
					this.pinnedStreamersEnabled.value = this.globalSettings().pinnedStreamersEnabled;
				},
			},
		],
	};

	initialize() {
		const quickAccessLinks = this.settings().quickAccessLinks;
		this.quickAccessLinks = signal(quickAccessLinks);
		this.pinnedStreamersEnabled.value = this.globalSettings().pinnedStreamersEnabled;
		this.pins = new ChannelPinsHelper("twitch", this.workerService());
		void this.pins.load();
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
		const login = this.currentLogin.value;
		if (this.pinnedStreamersEnabled.value && login) {
			actions.push({
				key: "pin-streamer",
				icon: this.pinStreamerIcon,
				tooltip: this.pinStreamerTooltip,
				onClick: () => {
					const currentLogin = this.currentLogin.value;
					if (currentLogin) void this.pins.setPinned(currentLogin, !this.isPinnedStreamer(currentLogin));
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

	private isPinnedStreamer(login: string): boolean {
		return !!login && this.pins.pins.value.has(login.toLowerCase());
	}

	private async updateWatchtime() {
		if (this.updateNames()) return;
		const login = this.currentLogin.value;
		if (login.length < 1) return;
		const now = Date.now();
		if (login === this.watchtimeLogin && now - this.watchtimeFetchedAt < ChannelSectionModule.WATCHTIME_REFRESH_MS) {
			return;
		}
		this.watchtimeLogin = login;
		this.watchtimeFetchedAt = now;
		try {
			this.watchtimeCounter.value = await this.getWatchTime(login);
		} catch (error) {
			this.logger.error("Failed to fetch watch time:", error);
		}
	}

	public async startWatchtimeUpdates() {
		if (!("value" in this.watchtimeCounter)) {
			this.watchtimeCounter = signal(0);
		}
		clearInterval(this.watchtimeInterval);
		await this.updateWatchtime();
		clearInterval(this.watchtimeInterval);
		this.watchtimeInterval = setInterval(async () => {
			if (document.hidden) return;
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
