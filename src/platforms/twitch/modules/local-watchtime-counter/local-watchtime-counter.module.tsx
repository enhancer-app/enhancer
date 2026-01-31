import { VideoCreatedAtQuery } from "$twitch/apis/twitch-queries.ts";
import TwitchModule from "$twitch/twitch.module.ts";
import type { VideoCreatedAtResponse } from "$types/platforms/twitch/twitch.api.types.ts";
import type { MediaPlayerInstance } from "$types/platforms/twitch/twitch.utils.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import { type Signal, signal } from "@preact/signals";
import { render } from "preact";
import styled from "styled-components";

export default class LocalWatchtimeCounterModule extends TwitchModule {
	config: TwitchModuleConfig = {
		name: "local-watchtme-counter",
		appliers: [
			{
				type: "selector",
				selectors: ['div[data-a-target="video-player"]'],
				callback: this.startWatchingChecker.bind(this),
				key: "real-video-time",
				validateUrl: (url) => !url.endsWith("twitch.tv/"), // Main page
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
			const mediaPlayerComponent = this.twitchUtils().getMediaPlayerComponent();
			if (!mediaPlayerComponent?.mediaPlayerInstance) return;
			const mediaPlayerInstance = mediaPlayerComponent.mediaPlayerInstance;
			if (mediaPlayerComponent?.content.type !== "live") return;
			const channelName = mediaPlayerComponent.content.channelLogin;
			if (!this.isLive()) return;
			if (mediaPlayerInstance && !mediaPlayerInstance.core.paused) {
				this.logger.debug(`Adding watchtime for ${channelName}`);
				await this.workerService().send("addWatchtime", {
					platform: "twitch",
					channel: channelName,
				});
			}
		}, 5000);
	}

	private isLive(): boolean {
		const currentLiveStatus = this.twitchUtils().getCurrentLiveStatus();
		if (!currentLiveStatus) {
			return false;
		}
		return !currentLiveStatus.isOffline && currentLiveStatus.isLive;
	}
}
