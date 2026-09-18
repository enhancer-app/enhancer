import TwitchModule from "$twitch/twitch.module.ts";
import type { RealVideoTimeComponentProps } from "$types/platforms/twitch/real-video-time.types.ts";
import type { MediaPlayerInstanceBase } from "$types/platforms/twitch/twitch.utils.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import { signal } from "@preact/signals";
import { render } from "preact";
import styled from "styled-components";

export default class RealVideoTimeModule extends TwitchModule {
	config: TwitchModuleConfig = {
		name: "real-video-time",
		appliers: [
			{
				type: "selector",
				selectors: [".player-controls__left-control-group"],
				callback: this.run.bind(this),
				key: "real-video-time",
				once: true,
			},
			{
				type: "event",
				key: "settings-real-video-time-format12h",
				event: "twitch:settings:realVideoTimeFormat12h",
				callback: (enabled) => this.updateTimeFormat(enabled),
			},
		],
		enabled: () => this.settings().realVideoTimeEnabled,
	};

	private timeCounter = signal<number | null>(null);
	private timeInterval: NodeJS.Timeout | undefined;
	private use12HourFormat = signal<boolean>(false);
	private mediaPlayer: MediaPlayerInstanceBase | undefined;
	private videoId: string | undefined;
	private syncTime: number | undefined;
	private timeOffset: number | undefined;

	private run(elements: Element[]) {
		const wrappers = this.commonUtils().createEmptyElements(this.getId(), elements, "span");
		wrappers.forEach((element) => {
			render(<RealTimeComponent formatTime={this.formatTime.bind(this)} time={this.timeCounter} />, element);
		});
		this.updateTime();
		if (this.timeInterval) {
			clearInterval(this.timeInterval);
		}
		this.timeInterval = setInterval(() => this.updateTime(), 1000);
	}

	private updateTimeFormat(enabled: boolean) {
		this.use12HourFormat.value = enabled;
		this.updateTime();
	}

	private formatTime(timeInMs: number): string {
		return this.commonUtils().timeInMsToTimestamp(timeInMs, this.use12HourFormat.value ? "12" : "24");
	}

	private updateTime() {
		const component = this.twitchUtils().getMediaPlayerComponent();
		if (component?.content?.type !== "vod" || !this.settings().realVideoTimeEnabled) {
			this.timeCounter.value = null;
			this.videoId = undefined;
			this.timeOffset = undefined;
			return;
		}
		const player = component.mediaPlayerInstance;
		if (this.mediaPlayer !== player || this.videoId !== component.content.vodID) {
			this.mediaPlayer = player;
			this.videoId = component.content.vodID;
			this.syncTime = undefined;
			this.timeOffset = undefined;
		}
		const position = player.getPosition();
		if (player.isSeeking?.() || !Number.isFinite(position)) {
			this.timeCounter.value = null;
			return;
		}
		const time = player.getSyncTime?.();
		if (typeof time === "number" && Number.isFinite(time) && time > 0 && time !== this.syncTime) {
			this.syncTime = time;
			this.timeOffset = time - position * 1000;
		}
		this.timeCounter.value = this.timeOffset === undefined ? null : this.timeOffset + position * 1000;
	}

	initialize() {
		this.use12HourFormat.value = this.settings().realVideoTimeFormat12h;
	}
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
	return time.value === null ? null : <Wrapper>{formatTime(time.value)}</Wrapper>;
}
