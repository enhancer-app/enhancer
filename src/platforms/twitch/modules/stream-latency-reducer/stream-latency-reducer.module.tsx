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

			// this.logger.debug(`Latency: ${latency}, minThreshold: ${minThreshold}, maxThreshold: ${maxThreshold}`);

			// add offset of 0.5 seconds to the latency when caught up.
			// prevents rapid rate changes when caught up
			if (status === "caughtUp") {
				latency -= 0.5;
			}
			if (latency >= maxThreshold) {
				// this.logger.debug("Max latency reached");
				// if (status === "catchingUpMax") return;
				this.setPlaybackRateMode("catchUpMax");
			} else if (latency >= minThreshold) {
				// this.logger.debug("Min latency reached");
				// if (status === "catchingUpMin") return;
				this.setPlaybackRateMode("catchUpMin");
			} else {
				// if (status === "caughtUp") return;
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

			const devLatencyButton = document.createElement("button");
			devLatencyButton.textContent = "Add Latency";
			devRoot.appendChild(devLatencyButton);
			devLatencyButton.onclick = () => {
				const video = document.querySelector(".video-ref")?.querySelector("video");
				if (!video) return;
				video.currentTime -= 5;
			};

			setInterval(async () => {
				devRoot.innerText = `Latency: ${this.getLatency()?.toFixed(2)}
					Playback Rate: ${this.twitchUtils().getMediaPlayerPlaybackRate()?.toFixed(2)}
					Status: ${await this.getPlaybackRateStatus()}
					Min Rate: ${await this.getSettings().then((s) => s.minRate)}
					Max Rate: ${await this.getSettings().then((s) => s.maxRate)}
					Min Threshold: ${await this.getSettings().then((s) => s.minThreshold)}
					Max Threshold: ${await this.getSettings().then((s) => s.maxThreshold)}
					`;
				devRoot.appendChild(devLatencyButton);
			}, 1000);
		}, 3000);

		function playbackRateSetHook(rate: number) {
			// TODO: Implement detecting Twitch Low Latency mode
			const TwitchLowLatencyEnabled = true;

			try {
				if (TwitchLowLatencyEnabled && !(this as any)._enhancerAllowRateChange) return rate;
			} catch {}

			return orig_playbackRate_set.call(this, rate);
		}

		let orig_playbackRate_set: any;
		try {
			orig_playbackRate_set = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "playbackRate")?.set;
		} catch (error) {
			this.logger.error(error);
		}
		if (orig_playbackRate_set !== undefined) {
			if (orig_playbackRate_set !== playbackRateSetHook) {
				try {
					this.logger.info("Applying patch for playbackRate.");
					Object.defineProperty(HTMLVideoElement.prototype, "playbackRate", {
						set: playbackRateSetHook,
						get: Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "playbackRate")?.get,
					});
				} catch {}
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
			this.logger.debug("Patched playbackRate modified by FFZ");
		}

		(video as any)._enhancerAllowRateChange = true;
		video.playbackRate = rate;
		(video as any)._enhancerAllowRateChange = false;
	}

	private async setPlaybackRateMode(mode: "catchUpMin" | "catchUpMax" | "reset") {
		const video = this.twitchUtils().getMediaPlayerInstance()?.core.renderSurface.video.element();
		if (!video) return;

		let targetRate = 1;
		if (mode === "catchUpMax") {
			targetRate = (await this.getSettings()).maxRate;
		} else if (mode === "catchUpMin") {
			targetRate = (await this.getSettings()).minRate;
		}

		this.changePlaybackSpeed(video, targetRate);
	}

	private async getPlaybackRateStatus() {
		const mediaPlayer = this.getPlayer();
		if (!mediaPlayer) return;
		const playbackRate = this.twitchUtils().getMediaPlayerPlaybackRate();
		if (!playbackRate) return;
		const latency = this.getLatency();
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
