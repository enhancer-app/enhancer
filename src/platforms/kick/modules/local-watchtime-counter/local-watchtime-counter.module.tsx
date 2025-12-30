import { type Signal, signal } from "@preact/signals";
import { render } from "preact";
import styled from "styled-components";
import KickModule from "$kick/kick.module.ts";
import { VideoCreatedAtQuery } from "$twitch/apis/twitch-queries.ts";
import TwitchModule from "$twitch/twitch.module.ts";
import type { VideoCreatedAtResponse } from "$types/platforms/twitch/twitch.api.types.ts";
import type { MediaPlayerInstance } from "$types/platforms/twitch/twitch.utils.types.ts";
import type { KickModuleConfig, TwitchModuleConfig } from "$types/shared/module/module.types.ts";

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
