import KickModule from "$kick/kick.module.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";
import { signal } from "@preact/signals";

export default class StreamLatencyReducerModule extends KickModule {
	private updateInterval: NodeJS.Timeout | undefined;
	private latencyTimings = signal<number[]>([]);

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
			const status = this.getPlaybackRateStatus();

			if (status === "catchingUpMax") {
				this.setPlaybackRateMode("catchUpMax");
			} else if (status === "catchingUpMin") {
				this.setPlaybackRateMode("catchUpMin");
			} else {
				this.setPlaybackRateMode("reset");
			}
		}, 1000);
	}

	private changePlaybackSpeed(video: HTMLVideoElement, rate: number) {
		video.playbackRate = rate;
	}

	private setPlaybackRateMode(mode: "catchUpMin" | "catchUpMax" | "reset") {
		const videoPlayer = this.getPlayer();
		if (!videoPlayer) return;

		let targetRate = 1;
		const latency = this.computeLatency(videoPlayer);

		// Always reset playback speed in reset mode, regardless of latency.
		if (mode === "reset") {
			this.changePlaybackSpeed(videoPlayer, 1);
			return;
		}

		// When latency is zero, negative, or otherwise invalid, ensure playback speed is reset.
		if (!latency || latency <= 0) {
			this.changePlaybackSpeed(videoPlayer, 1);
			return;
		}
		const { minRate, maxRate, minThreshold: minSpeedThreshold, maxThreshold: maxSpeedThreshold } = this.getSettings();

		if (mode === "catchUpMax") {
			targetRate = maxRate;
		} else if (mode === "catchUpMin") {
			if (maxSpeedThreshold === minSpeedThreshold) {
				// Avoid division by zero when thresholds are equal; fall back to a step between minRate and maxRate.
				targetRate = latency >= maxSpeedThreshold ? maxRate : minRate;
			} else {
				targetRate =
					minRate + ((maxRate - minRate) * (latency - minSpeedThreshold)) / (maxSpeedThreshold - minSpeedThreshold);
			}
		}

		this.changePlaybackSpeed(videoPlayer, targetRate);
	}

	private getPlaybackRateStatus() {
		const videoPlayer = this.getPlayer();
		if (!videoPlayer) return;
		const latency = this.computeLatency(videoPlayer);
		if (!latency) return "invalid";

		const { maxThreshold, minThreshold } = this.getSettings();
		if (latency >= maxThreshold) return "catchingUpMax";
		if (latency > minThreshold) return "catchingUpMin";
		if (latency <= minThreshold) return "caughtUp";
		return "invalid";
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

	// Calculates latency based on average of past latency snapshots
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

	private getPlayer() {
		const video = document.querySelector("video");
		if (!video || !this.kickUtils().isLiveVideo(video)) {
			return null;
		}
		return video;
	}
}
