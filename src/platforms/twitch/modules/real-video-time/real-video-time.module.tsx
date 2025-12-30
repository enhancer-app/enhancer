import { type Signal, signal } from "@preact/signals";
import { render } from "preact";
import styled from "styled-components";
import { VideoCreatedAtQuery } from "$twitch/apis/twitch-queries.ts";
import TwitchModule from "$twitch/twitch.module.ts";
import type { VideoCreatedAtResponse } from "$types/platforms/twitch/twitch.api.types.ts";
import type { MediaPlayerInstance } from "$types/platforms/twitch/twitch.utils.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";

export default class RealVideoTimeModule extends TwitchModule {
	private static URL_CONFIG = (url: string) => {
		return url.includes("/videos/") || url.includes("/video/");
	};

	config: TwitchModuleConfig = {
		name: "real-video-time",
		appliers: [
			{
				type: "selector",
				selectors: [".player-controls__left-control-group"],
				callback: this.run.bind(this),
				key: "real-video-time",
				validateUrl: RealVideoTimeModule.URL_CONFIG,
				once: true,
			},
			{
				type: "event",
				key: "settings-real-video-time-format12h",
				event: "twitch:settings:realVideoTimeFormat12h",
				callback: (enabled) => this.updateTimeFormat(enabled),
			},
			{
				type: "event",
				event: "twitch:chatInitialized",
				callback: () => {
					if (!RealVideoTimeModule.URL_CONFIG(window.location.href)) {
						const elements = document.querySelectorAll(".enhancer-real-video-time");
						elements.forEach((element) => element.remove());
					}
				},
				key: "real-video-time-url-validator",
			},
		],
		isModuleEnabledCallback: async () => await this.settingsService().getSettingsKey("realVideoTimeEnabled"),
	};

	private timeCounter = {} as Signal<number>;
	private lastFailedVideoId: string | null = null;
	private currentVideoId: string | undefined;
	private timeInterval: NodeJS.Timeout | undefined;
	private videoCreatedAt = new Date(0);
	private mediaPlayer: MediaPlayerInstance | undefined;
	private use12HourFormat = signal<boolean>(false);

	private async run(elements: Element[]) {
		this.createTimeCounter();
		await this.updateCurrentVideo();
		const wrappers = this.commonUtils().createEmptyElements(this.getId(), elements, "span");
		wrappers.forEach((element) => {
			render(<RealTimeComponent formatTime={this.formatTime.bind(this)} time={this.timeCounter} />, element);
		});
		this.updateTime();
		if (this.timeInterval) {
			clearInterval(this.timeInterval);
		}
		this.timeInterval = setInterval(async () => {
			await this.updateCurrentVideo();
			this.updateTime();
		}, 1000);
	}

	private updateTimeFormat(enabled: boolean) {
		this.use12HourFormat.value = enabled;
		this.updateTime();
	}

	private formatTime(timeInMs: number): string {
		return this.commonUtils().timeInMsToTimestamp(timeInMs, this.use12HourFormat.value ? "12" : "24");
	}

	private async getVideoCreatedAt(videoId: string) {
		try {
			const { data } = await this.getVideoTime(videoId);
			const createdAt = data?.video?.createdAt;
			if (!createdAt) return;
			const date = new Date(createdAt);
			if (Number.isNaN(date.getTime())) return;
			return date;
		} catch (error) {
			this.logger.warn("Failed to fetch video createdAt", error);
		}
	}

	private createTimeCounter() {
		if ("value" in this.timeCounter) return;
		this.timeCounter = signal<number>(-1);
	}

	private async updateCurrentVideo() {
		const videoId = this.twitchUtils().getVideoIdFromLink(window.location.href);
		if (!videoId) {
			this.lastFailedVideoId = null;
			return this.logger.warn("Failed to find video id");
		}
		if (this.currentVideoId === videoId) {
			return;
		}
		if (this.lastFailedVideoId === videoId) {
			return;
		}
		const createdAt = await this.getVideoCreatedAt(videoId);
		if (!createdAt) {
			this.logger.error(`Failed to get creation date for video ${videoId}. Aborting update.`);
			this.lastFailedVideoId = videoId;
			return;
		}
		this.logger.debug(`Creating real video time counter for ${videoId}`, this.videoCreatedAt);
		this.currentVideoId = videoId;
		this.videoCreatedAt = createdAt;
		this.lastFailedVideoId = null;
	}

	private updateTime() {
		const mediaPlayerInstance = this.mediaPlayer ?? this.twitchUtils().getMediaPlayerInstance();
		if (!mediaPlayerInstance) {
			this.logger.error("Failed to find media player instance");
			return;
		}
		this.mediaPlayer = mediaPlayerInstance;
		this.timeCounter.value = this.videoCreatedAt.getTime() + mediaPlayerInstance.getPosition() * 1000;
	}

	private async getVideoTime(videoId: string) {
		return this.twitchApi().gql<VideoCreatedAtResponse>(VideoCreatedAtQuery, {
			id: videoId,
		});
	}

	async initialize() {
		this.use12HourFormat.value = await this.settingsService().getSettingsKey("realVideoTimeFormat12h");
	}
}

interface RealVideoTimeComponentProps {
	time: Signal<number>;
	formatTime: (timeInSeconds: number) => string;
}

const Wrapper = styled.span`
	display: inline-flex;
	align-items: center;
	justify-content: center;
	color: #efeff1;
	margin: 0 8px;
	height: 100%;
	font-size: 14px;
	font-weight: normal;
	position: relative;
	vertical-align: middle;
`;

function RealTimeComponent({ time, formatTime }: RealVideoTimeComponentProps) {
	return <Wrapper>{formatTime(time.value)}</Wrapper>;
}
