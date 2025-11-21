import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import TwitchModule from "../../twitch.module.ts";

export default class StreamLatencyReducerModule extends TwitchModule {
	private updateInterval: NodeJS.Timeout | undefined;

	readonly config: TwitchModuleConfig = {
		name: "stream-latency-reducer",
		appliers: [
			{
				type: "selector",
				key: "stream-latency-reducer",
				selectors: ["[data-a-player-state]"],
				callback: this.run.bind(this),
				once: true,
			},
		],
		isModuleEnabledCallback: async () => await this.settingsService().getSettingsKey("streamLatencyReducerEnabled"),
	};

	private async run() {
		if (this.updateInterval) clearInterval(this.updateInterval);
		this.updateInterval = setInterval(async () => {
			const latency = this.getLatency();
			const status = await this.getPlaybackRateStatus();
			const { threshold } = await this.getSettings();
			if (latency && latency >= threshold && status === "caughtUp") {
				this.setPlaybackRate("catchUp");
			}
			if (latency && latency < threshold && status === "catchingUp") {
				this.setPlaybackRate("reset");
			}
		}, 1000);
	}

	private async setPlaybackRate(method: "catchUp" | "reset") {
		const mediaPlayer = this.getPlayer();
		if (!mediaPlayer) return;
		const video = mediaPlayer.core.renderSurface.video.element();
		if (method === "catchUp") {
			const { catchUpRate } = await this.getSettings();
			this.logger.debug(`Max latency reached, speeding up playback rate to ${catchUpRate}x`);
			video.playbackRate = catchUpRate;
		} else {
			this.logger.debug("Latency caught up, resetting playback rate to 1x");
			video.playbackRate = 1;
		}
	}

	private async getPlaybackRateStatus() {
		const mediaPlayer = this.getPlayer();
		if (!mediaPlayer) return;
		const video = mediaPlayer.core.renderSurface.video.element();
		const { catchUpRate } = await this.getSettings();
		if (video.playbackRate >= Math.abs(catchUpRate)) return "catchingUp";
		if (video.playbackRate <= Math.abs(1)) return "caughtUp";
		return "invalid";
	}

	private async getSettings() {
		const catchUpRate = await this.settingsService().getSettingsKey("streamLatencyReducerCatchUpRate");
		const threshold = await this.settingsService().getSettingsKey("streamLatencyReducerThreshold");
		return { catchUpRate, threshold };
	}

	private getLatency() {
		const mediaPlayer = this.getPlayer();
		if (!mediaPlayer) return;
		return mediaPlayer.core.state.liveLatency;
	}

	private getPlayer() {
		const mediaPlayer = this.twitchUtils().getMediaPlayerInstance();
		if (!mediaPlayer) {
			this.logger.warn("Failed to find media player");
			return;
		}
		return mediaPlayer;
	}
}
