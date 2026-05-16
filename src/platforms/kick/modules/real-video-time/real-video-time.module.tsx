import { type Signal, signal } from "@preact/signals";
import { render } from "preact";
import styled from "styled-components";
import KickModule from "$kick/kick.module.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";

export default class RealVideoTimeModule extends KickModule {
	config: KickModuleConfig = {
		name: "real-video-time",
		appliers: [
			{
				type: "selector",
				key: "real-video-time",
				selectors: ["#injected-embedded-channel-player-video"],
				callback: this.run.bind(this),
				once: true,
			},
			{
				type: "event",
				key: "settings-real-video-time-format12h",
				event: "kick:settings:realVideoTimeFormat12h",
				callback: (enabled) => this.updateTimeFormat(enabled),
			},
		],
		enabled: () => this.settings().realVideoTimeEnabled,
	};

	private timeCounter = signal(-1);
	private visibilitySignal = signal(true);
	private videoCreatedAt: Date | undefined;
	private timeInterval: NodeJS.Timeout | undefined;
	private use12HourFormat = signal<boolean>(false);
	private elementCheckInterval: NodeJS.Timeout | undefined;

	private async run(elements: Element[]) {
		const video = document.querySelector<HTMLVideoElement>("video");
		if (!video) return;
		this.tryGetVideoCreatedAt();
		this.updateTime(video);
		this.createTimeInterval(video);
		elements.forEach((element) => {
			const htmlElement = element as HTMLElement;
			htmlElement.addEventListener("mouseenter", async () => {
				await this.commonUtils().delay(25);
				this.updateVisibility();
				this.createElement(element);
			});
			htmlElement.addEventListener("click", async () => {
				await this.commonUtils().delay(25);
				this.updateVisibility();
				const video = document.querySelector("video");
				if (video) this.updateTime(video);
			});
		});

		if (this.elementCheckInterval) clearInterval(this.elementCheckInterval);
		this.elementCheckInterval = setInterval(() => {
			const created = elements.some((element) => this.createElement(element));
			if (created) this.updateVisibility();
		}, 1000);
	}

	private updateTimeFormat(enabled: boolean) {
		this.use12HourFormat.value = enabled;
	}

	private formatTime(timeInMs: number): string {
		return this.commonUtils().timeInMsToTimestamp(timeInMs, this.use12HourFormat.value ? "12" : "24");
	}

	private createElement(player: Element): boolean {
		if (player.querySelector(`#${this.getId()}`)) return false;
		const element = player.querySelector(".z-controls.absolute");
		if (!element || !element.firstElementChild) return false;
		const wrapper = document.createElement("div");
		wrapper.id = this.getId();
		wrapper.classList.add("enhancer-video-real-time-wrapper");
		render(
			<RealTimeComponent
				formatTime={this.formatTime.bind(this)}
				visibility={this.visibilitySignal}
				time={this.timeCounter}
			/>,
			wrapper,
		);
		element.firstElementChild.after(wrapper);
		return true;
	}

	private createTimeInterval(video: HTMLVideoElement) {
		if (this.timeInterval) clearInterval(this.timeInterval);
		this.timeInterval = setInterval(() => this.updateTime(video), 1000);
	}

	private updateVisibility() {
		const streamStatus = this.kickUtils().getStreamStatusProps();
		this.visibilitySignal.value = window.location.href.includes("/videos/") || streamStatus?.isLive === false;
	}

	private updateTime(video: HTMLVideoElement) {
		this.updateVisibility();
		const time = this.getCurrentRealVideoTime(video);
		if (!time) return;
		this.timeCounter.value = time;
	}

	private tryGetVideoCreatedAt() {
		const videoCreatedAt = this.kickUtils().getIsoDateProps();
		if (videoCreatedAt) this.videoCreatedAt = new Date(videoCreatedAt.isoDate);
	}

	private getCurrentRealVideoTime(video: HTMLVideoElement) {
		if (!this.videoCreatedAt) this.tryGetVideoCreatedAt();
		if (this.videoCreatedAt) return this.videoCreatedAt.getTime() + video.currentTime * 1000;

		const videoProgress = this.kickUtils().getVideoProgressProps();
		if (!videoProgress) return;
		const currentTime = Date.now();
		const timeOffset = videoProgress.durationInMs - videoProgress.currentProgressInMs;
		return currentTime - timeOffset;
	}

	initialize() {
		this.use12HourFormat.value = this.settings().realVideoTimeFormat12h;
		this.commonUtils().createGlobalStyle(`
			.enhancer-video-real-time-wrapper {
				flex-grow: 1;
				display: flex;
				align-items: center;
			}
		`);
	}
}

interface RealVideoTimeComponentProps {
	time: Signal<number>;
	visibility: Signal<boolean>;
	formatTime: (timeInSeconds: number) => string;
}

const Wrapper = styled.span<{ isVisible: boolean }>`
	display: ${(props) => (props.isVisible ? "inline-flex" : "none")};
	align-items: center;
	justify-content: flex-start;
	color: #efeff1;
	margin: 8px 0 8px 16px;
	font-size: 14px;
	font-weight: bold;
`;

function RealTimeComponent({ time, visibility, formatTime }: RealVideoTimeComponentProps) {
	return <Wrapper isVisible={visibility.value}>{formatTime(time.value)}</Wrapper>;
}
