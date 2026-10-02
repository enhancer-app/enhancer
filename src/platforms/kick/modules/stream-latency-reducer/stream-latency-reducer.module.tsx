import KickModule from "$kick/kick.module.ts";
import LatencySampler from "$kick/kick.latency-sampler.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";

export default class StreamLatencyReducerModule extends KickModule {
	private updateInterval: NodeJS.Timeout | undefined;
	private latencySampler = new LatencySampler();
	private appliedRate = 1;

	readonly config: KickModuleConfig = {
		name: "stream-latency-reducer",
		appliers: [
			{
				type: "selector",
				key: "stream-latency-reducer",
				selectors: ["#channel-chatroom"],
				callback: this.run.bind(this),
				validateUrl: (url) => {
					return !url.includes("/videos/") && !url.includes("/clips/");
				},
				once: true,
			},
		],
		enabled: () => this.settings().streamLatencyReducerEnabled,
	};

	private run(): void {
		if (this.updateInterval) clearInterval(this.updateInterval);
		this.updateInterval = setInterval(() => {
			const video = document.querySelector<HTMLVideoElement>("video#video-player");

			if (!video) {
				this.latencySampler.clear();

				return;
			}

			if (!this.kickUtils().isLiveVideo(video) || video.paused) {
				this.latencySampler.clear();
				this.resetPlaybackSpeed(video);

				return;
			}

			const latency = this.latencySampler.add(this.kickUtils().getLatency(video));
			this.changePlaybackSpeed(video, this.getTargetRate(latency));
		}, 1000);
	}

	private changePlaybackSpeed(video: HTMLVideoElement, rate: number) {
		this.appliedRate = rate;
		video.playbackRate = rate;
	}

	// Only undo our own catch-up rate so a manually chosen VOD speed is left alone.
	private resetPlaybackSpeed(video: HTMLVideoElement) {
		if (this.appliedRate === 1) return;
		this.changePlaybackSpeed(video, 1);
	}

	private getTargetRate(latency: number | undefined): number {
		const { minRate, maxRate, minThreshold, maxThreshold } = this.getSettings();

		if (latency === undefined || latency <= minThreshold) return 1;

		if (latency >= maxThreshold) return maxRate;

		return minRate + ((maxRate - minRate) * (latency - minThreshold)) / (maxThreshold - minThreshold);
	}

	private getSettings() {
		const settings = this.settings();

		return {
			minRate: settings.streamLatencyReducerMinRate,
			maxRate: settings.streamLatencyReducerMaxRate,
			minThreshold: settings.streamLatencyReducerMinThreshold,
			maxThreshold: settings.streamLatencyReducerMaxThreshold,
		};
	}
}
