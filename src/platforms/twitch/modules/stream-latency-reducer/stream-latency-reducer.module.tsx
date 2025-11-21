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

	private run() {
		if (this.updateInterval) clearInterval(this.updateInterval);
		this.updateInterval = setInterval(async () => {
			const latency = this.getLatency();
			const status = this.getPlaybackRateStatus();
			if (latency && latency >= 3 && status === "caughtUp") {
				this.setPlaybackRate("catchUp");
			}
			if (latency && latency < 3 && status === "catchingUp") {
				this.setPlaybackRate("reset");
			}
		}, 1000);
	}

	private setPlaybackRate(method: "catchUp" | "reset") {
		const mediaPlayer = this.getPlayer();
		if (!mediaPlayer) return;
		const video = mediaPlayer.core.renderSurface.video.element();
		if (method === "catchUp") {
			this.logger.debug("Max latency reached, speeding up playback rate to 1.3");
			video.playbackRate = 1.3;
		} else {
			this.logger.debug("Latency caught up, resetting playback rate to 1");
			video.playbackRate = 1;
		}
	}

	private getPlaybackRateStatus() {
		const mediaPlayer = this.getPlayer();
		if (!mediaPlayer) return;
		const video = mediaPlayer.core.renderSurface.video.element();
		if (video.playbackRate >= Math.abs(1.3)) return "catchingUp";
		if (video.playbackRate <= Math.abs(1)) return "caughtUp";
		return "invalid";
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
