import { LatencyComponent } from "$shared/components/latency/latency.component.tsx";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import { type Signal, signal } from "@preact/signals";
import { render } from "preact";
import TwitchModule from "../../twitch.module.ts";

export default class StreamLatencyModule extends TwitchModule {
	private latencyCounter = {} as Signal<number>;
	private isLiveState = {} as Signal<boolean>;
	private playbackRate = {} as Signal<number>;
	private trackedVideo: HTMLVideoElement | null = null;
	private consecutiveUnknownLatency = 0;
	private updateInterval: NodeJS.Timeout | undefined;

	readonly config: TwitchModuleConfig = {
		name: "stream-latency",
		appliers: [
			{
				type: "selector",
				key: "stream-latency",
				selectors: [".stream-chat-header"],
				callback: this.run.bind(this),
				validateUrl: (url) => {
					return !url.includes("/popout/") && !url.includes("/embed/");
				},
				once: true,
			},
		],
		enabled: () => this.settings().streamLatencyEnabled,
	};

	private readonly handleRateChange = (event: Event) => {
		const video = event.target as HTMLVideoElement | null;
		if (video) this.playbackRate.value = video.playbackRate;
	};

	private run(elements: Element[]) {
		const wrappers = elements.map((element) => {
			const wrapper = document.createElement("span");
			wrapper.id = this.getId();
			element.appendChild(wrapper);
			return wrapper;
		});

		this.createLatencyCounter();
		this.createPlaybackRateSignal();
		this.syncPlaybackRate();
		this.updateLatency();

		if (this.updateInterval) clearInterval(this.updateInterval);
		this.updateInterval = setInterval(() => this.updateLatency(), 1000);

		wrappers.forEach((element: HTMLElement) => {
			const header = document.querySelector("#chat-room-header-label") as HTMLElement | null;
			if (header) header.style.display = "none";
			render(
				<LatencyComponent
					isLive={this.isLiveState}
					latencyCounter={this.latencyCounter}
					playbackRate={this.playbackRate}
					click={this.resetPlayer.bind(this)}
				/>,
				element,
			);
		});
	}

	private updateLatency() {
		try {
			const videoInfo = this.twitchUtils().getVideoInfo();
			const liveStatus = this.twitchUtils().getCurrentLiveStatus();

			const isVod = videoInfo?.content.type === "vod";
			const isBroadcasterLive = !!(liveStatus?.isLive && !liveStatus.isOffline);

			const isLive = !isVod && isBroadcasterLive;

			if (this.isLiveState.value !== isLive) {
				this.isLiveState.value = isLive;
			}

			this.syncPlaybackRate();

			if (!isLive) {
				this.latencyCounter.value = -1;
				this.consecutiveUnknownLatency = 0;
				return;
			}

			const latency = this.getLatency();
			if (typeof latency === "number" && Number.isFinite(latency) && latency > 0) {
				this.latencyCounter.value = latency;
				this.consecutiveUnknownLatency = 0;
				return;
			}

			this.latencyCounter.value = -1;
			this.consecutiveUnknownLatency += 1;
			if (this.consecutiveUnknownLatency === 10 || this.consecutiveUnknownLatency % 60 === 0) {
				const mediaPlayer = this.twitchUtils().getMediaPlayerInstance();
				const video = mediaPlayer?.core?.renderSurface?.video?.element?.();
				this.logger.warn("Stream latency unavailable", {
					contentType: videoInfo?.content?.type,
					statusLive: liveStatus?.isLive,
					statusOffline: liveStatus?.isOffline,
					statusPlaying: liveStatus?.isPlaying,
					adShowing: liveStatus?.isVideoAdShowing,
					hasPlayer: !!mediaPlayer,
					reportedLatency: mediaPlayer?.core?.state?.liveLatency,
					videoPaused: video?.paused,
					videoReadyState: video?.readyState,
				});
			}
		} catch (error) {
			this.logger.error("Failed to update stream latency", error);
		}
	}

	private syncPlaybackRate() {
		if (!("value" in this.playbackRate)) return;
		const video = this.twitchUtils().getMediaPlayerInstance()?.core?.renderSurface?.video?.element?.();
		if (!video) return;
		if (this.playbackRate.value !== video.playbackRate) this.playbackRate.value = video.playbackRate;
		if (this.trackedVideo !== video) {
			this.trackedVideo?.removeEventListener("ratechange", this.handleRateChange);
			video.addEventListener("ratechange", this.handleRateChange);
			this.trackedVideo = video;
		}
	}

	private resetPlayer() {
		const mediaPlayer = this.twitchUtils().getMediaPlayerInstance();
		if (!mediaPlayer) {
			this.logger.warn("Failed to find media player");
			return;
		}
		const latency = this.getLatency();
		if (typeof latency !== "number" || latency <= 0) return;
		mediaPlayer.seekTo(mediaPlayer.getPosition() + latency);
	}

	private getLatency() {
		const mediaPlayer = this.twitchUtils().getMediaPlayerInstance();
		if (!mediaPlayer) {
			this.logger.debug("Failed to find media player");
			return;
		}
		const reported = mediaPlayer.core?.state?.liveLatency;
		if (typeof reported === "number" && Number.isFinite(reported) && reported > 0) return reported;
		const video = mediaPlayer.core?.renderSurface?.video?.element?.();
		if (!video || video.paused || video.buffered.length === 0) return reported;
		const fallback = video.buffered.end(video.buffered.length - 1) - video.currentTime;
		if (typeof fallback === "number" && Number.isFinite(fallback) && fallback > 0) return fallback;
		return reported;
	}

	private createPlaybackRateSignal() {
		if ("value" in this.playbackRate) return;
		const video = this.twitchUtils().getMediaPlayerInstance()?.core?.renderSurface?.video?.element?.();
		if (!video) {
			this.playbackRate = signal(1);
			return;
		}
		this.playbackRate = signal(video.playbackRate);
	}

	private createLatencyCounter() {
		if ("value" in this.latencyCounter) return;
		this.latencyCounter = signal(-1);
		this.isLiveState = signal(true);
	}
}
