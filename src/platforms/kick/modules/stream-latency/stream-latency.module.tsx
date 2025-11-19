import KickModule from "$kick/kick.module.ts";
import { LatencyComponent } from "$shared/components/latency/latency.component.tsx";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";
import { signal } from "@preact/signals";
import { render } from "preact";

export default class StreamLatencyModule extends KickModule {
	private latencyCounter = signal(-1);
	private isLiveState = signal(false);
	private updateInterval: NodeJS.Timeout | undefined;
	private playbackRate = signal(1);
	private threshold = signal(5);
	private latencyTimings = signal<number[]>([]);

	readonly config: KickModuleConfig = {
		name: "stream-latency",
		appliers: [
			{
				type: "selector",
				key: "stream-latency",
				selectors: ["#channel-chatroom"],
				callback: this.run.bind(this),
				validateUrl: (url) => {
					return !url.includes("/videos/") && !url.includes("/clips/");
				},
				once: true,
			},
		],
		isModuleEnabledCallback: async () => await this.settingsService().getSettingsKey("streamLatencyEnabled"),
	};

	private run(elements: Element[]): void {
		if (elements.length > 1) {
			this.logger.debug("Found multiple elements of chat room");
		}

		if (this.updateInterval) clearInterval(this.updateInterval);
		this.updateInterval = setInterval(() => this.updateLatency(), 500);

		for (const chatRoom of elements) {
			const span = chatRoom.firstElementChild?.querySelector<HTMLSpanElement>("span");
			if (!span) continue;
			span.textContent = "";
			render(
				<LatencyComponent
					isLive={this.isLiveState}
					latencyCounter={this.latencyCounter}
					playbackRate={this.playbackRate}
					click={this.resetPlayer.bind(this)}
				/>,
				span,
			);
		}
	}

	private updateLatency(): void {
		const video = this.getVideoElement();
		if (!video || !this.kickUtils().isLiveVideo(video)) {
			this.setLive(false);
			return;
		}
		this.setLive(true);
		if (video.paused) return;
		this.latencyCounter.value = this.computeLatency(video);

		this.playbackRate.value = Number.parseFloat(video.playbackRate.toFixed(2));

		if (this.latencyCounter.value > this.threshold.value) {
			const min = 1.03;
			const max = 1.1;
			const maxSpeedLatency = this.threshold.value * 3;

			video.playbackRate =
				this.latencyCounter.value > maxSpeedLatency
					? max
					: min +
						((max - min) * (this.latencyCounter.value - this.threshold.value)) /
							(maxSpeedLatency - this.threshold.value);
		} else {
			video.playbackRate = 1;
		}
	}

	private computeLatency(video: HTMLVideoElement): number {
		const { currentTime, buffered } = video;
		if (buffered.length === 0) return -1;
		const bufferEnd = buffered.end(buffered.length - 1);

		this.latencyTimings.value.push(bufferEnd - currentTime);

		if (!this.updateInterval) return 0;
		const numberOfSamples = 10;
		if (this.latencyTimings.value.length > numberOfSamples) this.latencyTimings.value.shift();

		return (
			this.latencyTimings.value.reduce((accumulator, currentValue) => accumulator + currentValue, 0) /
			this.latencyTimings.value.length
		);
	}

	private resetPlayer(): void {
		const video = this.getVideoElement();
		if (!video) {
			this.logger.warn("Failed to find video element");
			return;
		}
		if (!this.kickUtils().isLiveVideo(video)) {
			video.currentTime = video.duration;
			return;
		}
		const latency = this.computeLatency(video);
		if (latency > 0) {
			video.currentTime += latency;
		}
	}

	private setLive(isLive: boolean): void {
		this.isLiveState.value = isLive;
	}

	private getVideoElement(): HTMLVideoElement | null {
		return document.querySelector("video");
	}
}
