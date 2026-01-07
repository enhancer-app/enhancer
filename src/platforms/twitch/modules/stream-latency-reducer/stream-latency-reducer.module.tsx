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
			const { minThreshold, maxThreshold } = await this.getSettings();
			let latency = this.getLatency();
			if (!latency) return;
			// add offset of 0.5 seconds to the latency when caught up.
			// prevents rapid rate changes when caught up
			if (status === "caughtUp") {
				latency -= 0.5;
			}
			if (latency >= maxThreshold) {
				if (status === "catchingUpMax") return;
				this.setPlaybackRateMode("catchUpMax");
			} else if (latency >= minThreshold) {
				if (status === "catchingUpMin") return;
				this.setPlaybackRateMode("catchUpMin");
			} else {
				if (status === "caughtUp") return;
				this.setPlaybackRateMode("reset");
			}
		}, 1000);

		//! DEV ONLY, delete before release
		setTimeout(() => {
			this.logger.debug("Added dev window");
			const devRoot = document.createElement("div");
			document.querySelector(".video-player__overlay")?.appendChild(devRoot);
			devRoot.style.position = "absolute";
			devRoot.style.right = "0";
			devRoot.style.top = "0";
			devRoot.style.width = "fit-content";
			devRoot.style.height = "fit-content";
			devRoot.style.backgroundColor = "red";
			devRoot.style.padding = "10px";
			devRoot.textContent = "test";

			setInterval(async () => {
				devRoot.innerHTML = `Latency: ${this.getLatency()?.toFixed(2)} <br>
					Playback Rate: ${this.twitchUtils().getMediaPlayerPlaybackRate()?.toFixed(2)} <br>
					Status: ${await this.getPlaybackRateStatus()} <br>
					Min Rate: ${await this.getSettings().then((s) => s.minRate)} <br>
					Max Rate: ${await this.getSettings().then((s) => s.maxRate)} <br>
					Min Threshold: ${await this.getSettings().then((s) => s.minThreshold)} <br>
					Max Threshold: ${await this.getSettings().then((s) => s.maxThreshold)}
					`;
			}, 100);
		}, 3000);

		this.updatePlaybackRate();
	}

	private updatePlaybackRate() {
		const video = this.getPlayer();
		if (!video) return;

		if (!video.setEnhancedPlaybackRate) this.installPlaybackRate(video);

		video.setEnhancedPlaybackRate(video.playbackRate);
	}

	private installPlaybackRate(video: any) {
		if (video.setFFZPlaybackRate) return;

		let playbackRate = video.playbackRate;

		const installProperty = () => {
			Object.defineProperty(video, "playbackRate", {
				configurable: true,
				get() {
					return playbackRate;
				},
				set(val) {
					video.setEnhancedPlaybackRate(val);
				},
			});
		};

		video.setEnhancedPlaybackRate = (rate: number) => {
			video.playbackRat = undefined;
			playbackRate = rate;
			video.playbackRate = rate;
			installProperty();
		};
	}

	private async setPlaybackRateMode(mode: "catchUpMin" | "catchUpMax" | "reset") {
		const mediaPlayer = this.getPlayer();
		if (!mediaPlayer) return;
		const video = mediaPlayer.core.renderSurface.video.element();
		if (mode === "catchUpMax") {
			const { maxRate } = await this.getSettings();
			this.preventFFZOverride(video, maxRate);
			this.logger.debug(`Max latency reached, speeding up playback rate to ${maxRate}x`);
			video.playbackRate = maxRate;
		} else if (mode === "catchUpMin") {
			const { minRate } = await this.getSettings();
			this.preventFFZOverride(video, minRate);
			this.logger.debug(`Min latency reached, speeding up playback rate to ${minRate}x`);
			video.playbackRate = minRate;
		} else {
			this.logger.debug("Latency caught up, resetting playback rate to 1x");
			video.playbackRate = 1;
		}
	}

	private async getPlaybackRateStatus() {
		const mediaPlayer = this.getPlayer();
		if (!mediaPlayer) return;
		const playbackRate = this.twitchUtils().getMediaPlayerPlaybackRate();
		if (!playbackRate) return;
		const { maxRate, minRate } = await this.getSettings();
		if (playbackRate >= Math.abs(maxRate)) return "catchingUpMax";
		if (playbackRate >= Math.abs(minRate)) return "catchingUpMin";
		if (playbackRate <= Math.abs(1)) return "caughtUp";
		return "invalid";
	}

	private async getSettings() {
		const minRate = await this.settingsService().getSettingsKey("streamLatencyReducerMinRate");
		const maxRate = await this.settingsService().getSettingsKey("streamLatencyReducerMaxRate");
		const minThreshold = await this.settingsService().getSettingsKey("streamLatencyReducerMinThreshold");
		const maxThreshold = await this.settingsService().getSettingsKey("streamLatencyReducerMaxThreshold");
		return { minRate, maxRate, minThreshold, maxThreshold };
	}

	private preventFFZOverride(video: HTMLVideoElement, rate: number) {
		if (
			this.getFFZAllowCatchup() === false &&
			video &&
			"setFFZPlaybackRate" in video &&
			// check for modified playbackRate property by FFZ
			Object.prototype.hasOwnProperty.call(video, "playbackRate")
		) {
			this.logger.debug("FFZ playback rate override prevented");
			video.playbackRate = rate;
		}
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
