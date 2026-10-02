import { Logger } from "$shared/logger/logger.ts";
import type { WatchtimeDatabase } from "$shared/worker/watchtime/watchtime.database.ts";
import { createWatchtimeId } from "$shared/worker/watchtime/watchtime.utils.ts";
import type { AddWatchtimePayload, PlatformType, WatchtimeRecord } from "$types/shared/worker/worker.types.ts";

export class WatchtimeAccumulator {
	private readonly logger = new Logger({ context: "watchtime-accumulator", source: "background" });
	private watchedChannels = new Map<string, AddWatchtimePayload>();
	private updateInterval: ReturnType<typeof setInterval> | null = null;

	constructor(private readonly database: WatchtimeDatabase) {}

	initialize(): void {
		this.startUpdateInterval();
		this.logger.info("Watchtime accumulator initialized");
	}

	watchChannel(platform: PlatformType, channel: string): Promise<WatchtimeRecord | null> {
		const channelKey = createWatchtimeId(platform, channel);

		if (!this.watchedChannels.has(channelKey)) {
			this.watchedChannels.set(channelKey, { platform, channel: channelKey.split(":")[1] });
			this.logger.debug(`Started watching channel: ${channelKey}`);
		}

		return this.database.getWatchtime(platform, channel);
	}

	stop(): void {
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
			this.updateInterval = null;
		}

		this.logger.info("Watchtime accumulator stopped");
	}

	private startUpdateInterval(): void {
		this.updateInterval = setInterval(async () => {
			if (this.watchedChannels.size === 0) return;

			const channels = Array.from(this.watchedChannels.values());
			this.logger.debug(`Adding watchtime for: ${Array.from(this.watchedChannels.keys()).join(", ")}`);

			try {
				for (const { platform, channel } of channels) {
					await this.database.addWatchtime(platform, channel, 5);
				}

				this.watchedChannels.clear();
			} catch (error) {
				this.logger.error("Failed to update watchtime:", error);
			}
		}, 5000);
	}
}
