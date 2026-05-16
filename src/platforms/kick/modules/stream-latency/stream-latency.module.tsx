import { signal } from "@preact/signals";
import { render } from "preact";
import KickModule from "$kick/kick.module.ts";
import { LatencyComponent } from "$shared/components/latency/latency.component.tsx";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";

export default class StreamLatencyModule extends KickModule {
	private latencyCounter = signal(-1);
	private isLiveState = signal(false);
	private updateInterval: NodeJS.Timeout | undefined;
	private playbackRate = signal(1);
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
		enabled: () => this.settings().streamLatencyEnabled,
	};

	private run(elements: Element[]): void {
		if (elements.length > 1) {
			this.logger.debug("Found multiple elements of chat room");
		}

		this.watchPlaybackRate();

		if (this.updateInterval) clearInterval(this.updateInterval);
		this.updateInterval = setInterval(() => this.updateLatency(), 1000);

		for (const chatRoom of elements) {
			if (chatRoom.className.includes("--chat-clip")) continue;
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
	}

	private computeLatency(video: HTMLVideoElement): number {
		const computedLatency = this.kickUtils().getLatency(video);
		this.latencyTimings.value.push(computedLatency);

		// Reset timings array if experiences sudden increase in latency
		if (
			this.latencyTimings.value.length > 1 &&
			computedLatency - this.latencyTimings.value[this.latencyTimings.value.length - 2] > 2
		) {
			this.latencyTimings.value = [computedLatency];
		}

		const numberOfSamples = 10;
		if (this.latencyTimings.value.length > numberOfSamples) this.latencyTimings.value.shift();

		return (
			this.latencyTimings.value.reduce((accumulator, currentValue) => accumulator + currentValue, 0) /
			this.latencyTimings.value.length
		);
	}

	private watchPlaybackRate() {
		const video = this.getVideoElement();
		if (!video) return;
		video.addEventListener("ratechange", () => {
			this.playbackRate.value = video.playbackRate;
		});
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
