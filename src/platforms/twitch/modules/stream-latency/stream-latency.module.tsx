import { LatencyComponent } from "$shared/components/latency/latency.component.tsx";
import { isNumber } from "$shared/utils/type-guards.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import { signal } from "@preact/signals";
import { render } from "preact";
import TwitchModule from "../../twitch.module.ts";

export default class StreamLatencyModule extends TwitchModule {
	private latencyCounter = signal(-1);
	private isLiveState = signal(true);
	private playbackRate = signal(1);
	private playbackRateInitialized = false;
	private updateInterval: NodeJS.Timeout | undefined;

	readonly config: TwitchModuleConfig = {
		name: "stream-latency",
		appliers: [
			{
				type: "selector",
				key: "stream-latency",
				selectors: [".stream-chat-header"],
				callback: this.run.bind(this),
				validateUrl: (url) => {
					return !url.includes("/popout/") && !url.includes("/embed/");
				},
				once: true,
			},
		],
		enabled: () => this.settings().streamLatencyEnabled,
	};

	private run(elements: Element[]) {
		const wrappers = elements.map((element) => {
			const wrapper = document.createElement("span");
			wrapper.id = this.getId();
			element.appendChild(wrapper);

			return wrapper;
		});

		this.updateLatency();

		this.createPlaybackRateSignal();
		this.watchPlaybackRate();

		if (this.updateInterval) clearInterval(this.updateInterval);
		this.updateInterval = setInterval(async () => this.updateLatency(), 1000);

		wrappers.forEach((element: HTMLElement) => {
			const header = document.querySelector<HTMLElement>("#chat-room-header-label");

			if (header) header.style.display = "none";
			render(
				<LatencyComponent
					isLive={this.isLiveState}
					latencyCounter={this.latencyCounter}
					playbackRate={this.playbackRate}
					click={this.resetPlayer.bind(this)}
				/>,
				element,
			);
		});
	}

	private updateLatency() {
		const videoInfo = this.twitchUtils().getVideoInfo();
		const liveStatus = this.twitchUtils().getCurrentLiveStatus();

		const isVod = videoInfo?.content.type === "vod";
		const isBroadcasterLive = !!(liveStatus?.isLive && !liveStatus.isOffline);

		const isLive = !isVod && isBroadcasterLive;

		if (this.isLiveState.value !== isLive) {
			this.isLiveState.value = isLive;
		}

		if (isLive) {
			const latency = this.getLatency();
			this.latencyCounter.value = isNumber(latency) && latency > 0 ? latency : -1;
		}
	}

	private watchPlaybackRate() {
		const video = this.twitchUtils().getMediaPlayerInstance()?.core.renderSurface.video.element();

		if (!video) return;
		video.addEventListener("ratechange", () => {
			this.playbackRate.value = video.playbackRate;
		});
	}

	private resetPlayer() {
		const mediaPlayer = this.twitchUtils().getMediaPlayerInstance();

		if (!mediaPlayer) {
			this.logger.warn("Failed to find media player");

			return;
		}

		const latency = this.getLatency();

		if (!isNumber(latency) || latency <= 0) return;
		mediaPlayer.seekTo(mediaPlayer.getPosition() + latency);
	}

	private getLatency() {
		const mediaPlayer = this.twitchUtils().getMediaPlayerInstance();

		if (!mediaPlayer) {
			this.logger.warn("Failed to find media player");

			return;
		}

		return mediaPlayer.core.state.liveLatency;
	}

	private createPlaybackRateSignal() {
		if (this.playbackRateInitialized) return;
		this.playbackRateInitialized = true;
		const video = this.twitchUtils().getMediaPlayerInstance()?.core.renderSurface.video.element();

		if (!video) {
			this.playbackRate = signal(1);

			return;
		}

		this.playbackRate = signal(video.playbackRate);
	}
}
