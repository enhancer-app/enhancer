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
			const status = await this.getPlaybackRateStatus();

			if (status === "catchingUpMax") {
				this.setPlaybackRateMode("catchUpMax");
			} else if (status === "catchingUpMin") {
				this.setPlaybackRateMode("catchUpMin");
			} else {
				this.setPlaybackRateMode("reset");
			}
		}, 1000);

		async function playbackRateSetHook(this: HTMLVideoElement, rate: number) {
			// Workaround for twitch native delay reducer interfering, block any other attempts of changing playbackRate other that ours
			try {
				if (true && !(this as any)._enhancerAllowRateChange) return rate;
			} catch {}

			return orig_playbackRate_set.call(this, rate);
		}

		let orig_playbackRate_set: any;
		try {
			orig_playbackRate_set = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "playbackRate")?.set;
		} catch (error) {
			this.logger.error(error);
		}
		if (orig_playbackRate_set !== undefined && orig_playbackRate_set !== playbackRateSetHook) {
			try {
				this.logger.info("Applying patch for playbackRate.");
				Object.defineProperty(HTMLVideoElement.prototype, "playbackRate", {
					set: playbackRateSetHook,
					get: Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "playbackRate")?.get,
				});
			} catch(error) {
				this.logger.error("Failed to apply playbackRate patch:", error);
			}
		}
	}

	private changePlaybackSpeed(video: HTMLVideoElement, rate: number) {
		if (
			this.getFFZAllowCatchup() === false &&
			video &&
			Object.getOwnPropertyDescriptor(video, "playbackRate")?.set !== undefined
		) {
			try {
				// Needed to remove setter, which is then inherited
				// @ts-ignore - playbackRate's existence is implied by the check above
				// biome-ignore lint/performance/noDelete: setting to undefined does not reset it completely
				delete video.playbackRate;
			} catch (error) {
				this.logger.error(error);
			}
		}

		(video as any)._enhancerAllowRateChange = true;
		video.playbackRate = rate;
		(video as any)._enhancerAllowRateChange = false;
	}

	private async setPlaybackRateMode(mode: "catchUpMin" | "catchUpMax" | "reset") {
		const video = this.twitchUtils().getMediaPlayerInstance()?.core.renderSurface.video.element();
		if (!video) return;

		let targetRate = 1;
		const latency = this.getLatency();
		if (!latency) return;

		const {
			minRate,
			maxRate,
			minThreshold: minSpeedThreshold,
			maxThreshold: maxSpeedThreshold,
		} = await this.getSettings();

		if (mode === "catchUpMax") {
			targetRate = maxRate;
		} else if (mode === "catchUpMin") {
			targetRate =
				minRate + ((maxRate - minRate) * (latency - minSpeedThreshold)) / (maxSpeedThreshold - minSpeedThreshold);
		}

		this.changePlaybackSpeed(video, targetRate);
	}

	private async getPlaybackRateStatus() {
		const mediaPlayer = this.getPlayer();
		if (!mediaPlayer) return;
		const latency = this.getLatency();
		if (!latency) return "invalid";

		// Disable reducer without Low Latency mode
		if (window.localStorage.getItem("lowLatencyModeEnabled") === "false") return "caughtUp";

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

	private getFFZAllowCatchup() {
		const ffz = (window as any).ffz;
		if (ffz) {
			return ffz.settings.get("player.allow-catchup") as boolean;
		}
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
