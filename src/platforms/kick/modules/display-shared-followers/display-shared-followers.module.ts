import KickModule from "$kick/kick.module.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";

export default class DisplaySharedFollowersModule extends KickModule {
	config: KickModuleConfig = {
		name: "display-shared-followers",
		appliers: [
			{
				type: "event",
				event: "extension:start",
				callback: this.run.bind(this),
				key: "display-shared-followers-start",
			},
		],
		isModuleEnabledCallback: () => this.settingsService().getSettingsKey("displaySharedFollowersEnabled"),
	};

	private async run(): Promise<void> {
		await this.displayCrossPlatformLiveStreamers();
	}

	/**
	 * Retrieves all streamers from the live streamers cache, filters out Kick streamers
	 * (since we are the Kick module), and displays the cross-platform (Twitch) live streamers.
	 */
	private async displayCrossPlatformLiveStreamers(): Promise<void> {
		const response = await this.workerService().send("getLiveStreamersCache", {});
		if (!response) {
			this.logger.info("No live streamers cache available");
			return;
		}

		const crossPlatformStreamers = response.streamers.filter(
			(streamer) => streamer.platform !== "kick" && streamer.isLive,
		);

		if (crossPlatformStreamers.length === 0) {
			this.logger.info("No cross-platform live streamers found");
			return;
		}

		for (const streamer of crossPlatformStreamers) {
			this.logger.info(
				`[Cross-Platform Live] ${streamer.username} is live on ${streamer.platform} (channel: ${streamer.channelId})`,
			);
		}

		// TODO: Create UI component to display cross-platform live streamers.
		// For now, we only log them.
	}
}
