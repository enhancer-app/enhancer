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
		isModuleEnabledCallback: async () => await this.settingsService().getSettingsKey("streamLatencyReducerEnabled"),
	};

	private run(): void {
		if (this.updateInterval) clearInterval(this.updateInterval);
		this.updateInterval = setInterval(async () => {
			const status = await this.getPlaybackRateStatus();

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

	private async setPlaybackRateMode(mode: "catchUpMin" | "catchUpMax" | "reset") {
		const videoPlayer = this.getPlayer();
		if (!videoPlayer) return;

		let targetRate = 1;
		const latency = this.getLatency(videoPlayer);
		if (!latency) return;

		const minRate = (await this.getSettings()).minRate;
		const maxRate = (await this.getSettings()).maxRate;
		const minSpeedThreshold = (await this.getSettings()).minThreshold;
		const maxSpeedThreshold = (await this.getSettings()).maxThreshold;

		if (mode === "catchUpMax") {
			targetRate = maxRate;
		} else if (mode === "catchUpMin") {
			targetRate =
				minRate + ((maxRate - minRate) * (latency - minSpeedThreshold)) / (maxSpeedThreshold - minSpeedThreshold);
		}

		this.changePlaybackSpeed(videoPlayer, targetRate);
	}

	private async getPlaybackRateStatus() {
		const videoPlayer = this.getPlayer();
		if (!videoPlayer) return;
		const latency = this.getLatency(videoPlayer);
		if (!latency) return "invalid";

		const { maxThreshold, minThreshold } = await this.getSettings();
		if (latency >= Math.abs(maxThreshold)) return "catchingUpMax";
		if (latency > Math.abs(minThreshold)) return "catchingUpMin";
		if (latency <= Math.abs(minThreshold)) return "caughtUp";
		return "invalid";
	}

	private async getSettings() {
		const minRate = await this.settingsService().getSettingsKey("streamLatencyReducerMinRate");
		const maxRate = await this.settingsService().getSettingsKey("streamLatencyReducerMaxRate");
		const minThreshold = await this.settingsService().getSettingsKey("streamLatencyReducerMinThreshold");
		const maxThreshold = await this.settingsService().getSettingsKey("streamLatencyReducerMaxThreshold");
		return { minRate, maxRate, minThreshold, maxThreshold };
	}

	// Calculates latency based on
	private getLatency(video: HTMLVideoElement): number {
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

	private getPlayer() {
		const video = document.querySelector("video");
		if (!video || !this.kickUtils().isLiveVideo(video)) {
			return null;
		}
		return video;
	}
}
