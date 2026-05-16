import KickModule from "$kick/kick.module.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";
import { type Signal, signal } from "@preact/signals";
import { render } from "preact";
import styled from "styled-components";

export default class LocalWatchtimeCounterModule extends KickModule {
	config: KickModuleConfig = {
		name: "local-watchtme-counter",
		appliers: [
			{
				type: "selector",
				selectors: ["video"],
				callback: this.startWatchingChecker.bind(this),
				key: "real-video-time",
				validateUrl: (url) => !url.endsWith("kick.com/"), // Main page
				once: true,
			},
		],
	};

	private watchingCheckerInterval: NodeJS.Timeout | undefined;

	private startWatchingChecker() {
		if (this.watchingCheckerInterval) {
			clearInterval(this.watchingCheckerInterval);
		}
		this.watchingCheckerInterval = setInterval(async () => {
			const channelName = this.kickUtils().getChannelInfo()?.slug.toLowerCase();
			if (!channelName) return;
			const video = document.querySelector<HTMLVideoElement>("video");
			if (!video) return;
			if (!this.kickUtils().isLiveVideo(video)) return;
			if (video.paused) return;
			await this.workerService().send("addWatchtime", {
				platform: "kick",
				channel: channelName,
			});
		}, 5000);
	}
}
