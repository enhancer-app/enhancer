import { VideoCreatedAtQuery } from "$twitch/apis/twitch-queries.ts";
import TwitchModule from "$twitch/twitch.module.ts";
import type { VideoCreatedAtResponse } from "$types/platforms/twitch/twitch.api.types.ts";
import type { MediaPlayerInstanceBase } from "$types/platforms/twitch/twitch.utils.types.ts";
import type {
	RealVideoTimeComponentProps,
	RealVideoTimeDateMode,
} from "$types/shared/components/real-video-time.component.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import { signal } from "@preact/signals";
import { render } from "preact";
import styled from "styled-components";

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
				key: "settings-real-video-time-date-mode",
				event: "twitch:settings:realVideoTimeDateMode",
				callback: (mode) => this.updateDateMode(mode),
			},
			{
				type: "event",
				key: "settings-real-video-time-date-refresh",
				event: "extension:settings-refresh",
				callback: () => this.updateDateMode(this.settings().realVideoTimeDateMode ?? "hover"),
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
		enabled: () => this.settings().realVideoTimeEnabled,
	};

	private timeCounter = signal(-1);
	private lastFailedVideoId: string | null = null;
	private currentVideoId: string | undefined;
	private timeInterval: NodeJS.Timeout | undefined;
	private videoCreatedAt = new Date(0);
	private mediaPlayer: MediaPlayerInstanceBase | undefined;
	private use12HourFormat = signal<boolean>(false);
	private dateMode = signal<RealVideoTimeDateMode>("hover");

	private async run(elements: Element[]) {
		await this.updateCurrentVideo();
		const wrappers = this.commonUtils().createEmptyElements(this.getId(), elements, "span");
		wrappers.forEach((element) => {
			render(
				<RealTimeComponent
					formatTime={this.formatTime.bind(this)}
					formatDate={(timeInMs) => this.commonUtils().timeInMsToDate(timeInMs)}
					dateMode={this.dateMode}
					time={this.timeCounter}
				/>,
				element,
			);
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

	private updateDateMode(mode: RealVideoTimeDateMode) {
		this.dateMode.value = mode;
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

	initialize() {
		this.use12HourFormat.value = this.settings().realVideoTimeFormat12h;
		this.updateDateMode(this.settings().realVideoTimeDateMode ?? "hover");
	}
}

const DateDisplay = styled.span<{ $mode: RealVideoTimeDateMode }>`
	display: ${(props) => (props.$mode === "always" ? "inline" : "none")};
	margin-left: 4px;
`;

const Wrapper = styled.span`
	display: inline-flex;
	white-space: nowrap;
	align-items: center;
	justify-content: flex-start;
	color: #efeff1;
	margin: 0 8px;
	height: 100%;
	font-size: 14px;
	font-weight: normal;
	position: relative;
	vertical-align: middle;
	&:hover ${DateDisplay} {
		display: inline;
	}
`;

function RealTimeComponent({ time, dateMode, formatTime, formatDate }: RealVideoTimeComponentProps) {
	return (
		<Wrapper>
			{formatTime(time.value)}
			{time.value >= 0 && dateMode.value !== "never" && (
				<DateDisplay $mode={dateMode.value}>({formatDate(time.value)})</DateDisplay>
			)}
		</Wrapper>
	);
}
