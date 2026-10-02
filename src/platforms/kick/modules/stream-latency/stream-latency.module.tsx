import KickModule from "$kick/kick.module.ts";
import LatencySampler from "$kick/kick.latency-sampler.ts";
import { LatencyComponent } from "$shared/components/latency/latency.component.tsx";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";
import { signal } from "@preact/signals";
import { render } from "preact";

export default class StreamLatencyModule extends KickModule {
	private latencyCounter = signal(-1);
	private isLiveState = signal(false);
	private updateInterval: NodeJS.Timeout | undefined;
	private playbackRate = signal(1);
	private latencySampler = new LatencySampler();

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
			const chatTitle = chatRoom.querySelector<HTMLElement>(":is(span, h2).absolute.left-1\\/2.-translate-x-1\\/2");

			if (!chatTitle) continue;
			chatTitle.textContent = "";
			render(
				<LatencyComponent
					isLive={this.isLiveState}
					latencyCounter={this.latencyCounter}
					playbackRate={this.playbackRate}
					click={this.resetPlayer.bind(this)}
				/>,
				chatTitle,
			);
		}
	}

	private updateLatency(): void {
		const video = this.getVideoElement();
		const isLive = !!video && this.kickUtils().isLiveVideo(video);
		this.setLive(isLive);

		if (!video || !isLive || video.paused) {
			this.latencySampler.clear();
			this.latencyCounter.value = -1;

			return;
		}

		const latency = this.latencySampler.add(this.kickUtils().getLatency(video));
		this.latencyCounter.value = latency ?? -1;
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

		const latency = this.kickUtils().getLatency(video);

		if (latency !== undefined && latency > 0) {
			video.currentTime += latency;
			this.latencySampler.clear();
		}
	}

	private setLive(isLive: boolean): void {
		this.isLiveState.value = isLive;
	}

	private getVideoElement(): HTMLVideoElement | null {
		return document.querySelector("video#video-player");
	}
}
