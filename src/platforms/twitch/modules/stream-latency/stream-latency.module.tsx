import { LatencyComponent } from "$shared/components/latency/latency.component.tsx";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import { type Signal, signal } from "@preact/signals";
import { render } from "preact";
import TwitchModule from "../../twitch.module.ts";

export default class StreamLatencyModule extends TwitchModule {
	private latencyCounter = {} as Signal<number>;
	private isLiveState = {} as Signal<boolean>;
	private updateInterval: NodeJS.Timeout | undefined;
	private playbackRate = signal(1);
	private threshold = signal(5);

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
		isModuleEnabledCallback: async () => await this.settingsService().getSettingsKey("streamLatencyEnabled"),
	};

	private run(elements: Element[]) {
		const wrappers = elements.map((element) => {
			const wrapper = document.createElement("span");
			wrapper.id = this.getId();
			element.appendChild(wrapper);
			return wrapper;
		});

		this.createLatencyCounter();
		this.updateLatency();

		if (this.updateInterval) clearInterval(this.updateInterval);
		this.updateInterval = setInterval(async () => this.updateLatency(), 1000);

		wrappers.forEach((element: HTMLElement) => {
			const header = document.querySelector("#chat-room-header-label") as HTMLElement | null;
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
		const currentLiveStatus = this.twitchUtils().getCurrentLiveStatus();
		if (!currentLiveStatus) {
			return;
		}
		const isLive = !currentLiveStatus.isOffline && currentLiveStatus.isLive;
		this.isLiveState.value = isLive;
		if (!isLive) {
			return;
		}
		const latency = this.getLatency();
		if (latency === undefined || latency < 0) return;
		this.latencyCounter.value = latency;

		try {
			const video = this.twitchUtils().getMediaPlayerInstance();
			if (!video) return;
			const videoPlayer = video.core.state;
			if (!videoPlayer || !videoPlayer.playbackRate) return;

			this.playbackRate.value = Number.parseFloat(videoPlayer.playbackRate.toFixed(2));

			if (this.latencyCounter.value > this.threshold.value) {
				const min = 1.03;
				const max = 1.1;
				const maxSpeedLatency = this.threshold.value * 3;

				videoPlayer.playbackRate =
					this.latencyCounter.value > maxSpeedLatency
						? max
						: min +
							((max - min) * (this.latencyCounter.value - this.threshold.value)) /
								(maxSpeedLatency - this.threshold.value);
			} else {
				videoPlayer.playbackRate = 1;
			}
		} catch (error) {
			console.error(error);
		}
	}

	private resetPlayer() {
		const mediaPlayer = this.twitchUtils().getMediaPlayerInstance();
		if (!mediaPlayer) {
			this.logger.warn("Failed to find media player");
			return;
		}
		const currentPosition = mediaPlayer.getPosition();
		const latency = this.getBuffer();
		if (latency === undefined || latency < 0) return;
		mediaPlayer.seekTo(currentPosition + latency);
	}

	private getLatency() {
		const mediaPlayer = this.twitchUtils().getMediaPlayerInstance();
		if (!mediaPlayer) {
			this.logger.warn("Failed to find media player");
			return;
		}
		return mediaPlayer.core.state.liveLatency;
	}

	private getBuffer() {
		const mediaPlayer = this.twitchUtils().getMediaPlayerInstance();
		if (!mediaPlayer) {
			this.logger.warn("Failed to find media player");
			return;
		}
		return mediaPlayer.core.state.ingestLatency;
	}

	private createLatencyCounter() {
		if ("value" in this.latencyCounter) return;
		this.latencyCounter = signal(-1);
		this.isLiveState = signal(true);
	}
}
