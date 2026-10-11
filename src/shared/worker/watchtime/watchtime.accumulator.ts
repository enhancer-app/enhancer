import { Logger } from "$shared/logger/logger.ts";
import type { WatchtimeDatabase } from "$shared/worker/watchtime/watchtime.database.ts";
import { createWatchtimeId } from "$shared/worker/watchtime/watchtime.utils.ts";
import type { PlatformType, WatchtimeChannel } from "$types/shared/worker/worker.types.ts";

export class WatchtimeAccumulator {
	private readonly logger = new Logger({ context: "watchtime-accumulator", source: "background" });
	private watchedChannels = new Set<string>();
	private updateInterval: ReturnType<typeof setInterval> | null = null;

	constructor(private readonly database: WatchtimeDatabase) {}

	initialize(): void {
		this.startUpdateInterval();
		this.logger.info("Watchtime accumulator initialized");
	}

	watchChannel(platform: PlatformType, channel: string): void {
		const channelKey = createWatchtimeId(platform, channel);
		if (!this.watchedChannels.has(channelKey)) {
			this.watchedChannels.add(channelKey);
			this.logger.debug(`Started watching channel: ${channelKey}`);
		}
	}

	stop(): void {
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
			this.updateInterval = null;
		}
		this.logger.info("Watchtime accumulator stopped");
	}

	private parseChannelKey(key: string): WatchtimeChannel {
		const [platform, username] = key.split(":");
		return { platform: platform as PlatformType, username };
	}

	private startUpdateInterval(): void {
		this.updateInterval = setInterval(async () => {
			if (this.watchedChannels.size === 0) return;

			const channels = Array.from(this.watchedChannels);
			this.watchedChannels.clear();
			this.logger.debug(`Adding watchtime for: ${channels.join(", ")}`);

			try {
				await this.database.addWatchtime(
					channels.map((channelKey) => this.parseChannelKey(channelKey)),
					5,
				);
			} catch (error) {
				for (const channelKey of channels) this.watchedChannels.add(channelKey);
				this.logger.error("Failed to update watchtime:", error);
			}
		}, 5000);
	}
}
