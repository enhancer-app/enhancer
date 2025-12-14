import { Logger } from "$shared/logger/logger.ts";
import { WatchtimeDatabase } from "$shared/worker/watchtime/watchtime.database.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { WatchtimeRecord } from "$types/shared/worker/worker.types.ts";

export class WatchtimeService {
	private readonly logger = new Logger({ context: "watchtime-service" });
	private readonly database = new WatchtimeDatabase();
	private watchedChannels = new Set<string>(); // Format: "platform:username"
	private updateInterval: NodeJS.Timeout | null = null;

	async initialize(): Promise<void> {
		await this.database.initialize();
		this.startUpdateInterval();
		this.logger.info("Watchtime service initialized");
	}

	private createChannelKey(platform: PlatformType, channel: string): string {
		return `${platform}:${channel.toLowerCase()}`;
	}

	private parseChannelKey(key: string): { platform: PlatformType; channel: string } {
		const [platform, channel] = key.split(":");
		return { platform: platform as PlatformType, channel };
	}

	private startUpdateInterval(): void {
		this.updateInterval = setInterval(async () => {
			if (this.watchedChannels.size === 0) return;

			const channels = Array.from(this.watchedChannels);
			this.logger.debug(`Adding watchtime for: ${channels.join(", ")}`);

			try {
				for (const channelKey of channels) {
					const { platform, channel } = this.parseChannelKey(channelKey);
					await this.database.addWatchtime(platform, channel, 5);
				}
				this.watchedChannels.clear();
			} catch (error) {
				this.logger.error("Failed to update watchtime:", error);
			}
		}, 5000);
	}

	async watchChannel(platform: PlatformType, channel: string): Promise<WatchtimeRecord | null> {
		const channelKey = this.createChannelKey(platform, channel);

		if (!this.watchedChannels.has(channelKey)) {
			this.watchedChannels.add(channelKey);
			this.logger.debug(`Started watching channel: ${channelKey}`);
		}

		return await this.database.getWatchtime(platform, channel);
	}

	async getWatchtime(platform: PlatformType, channel: string): Promise<WatchtimeRecord | null> {
		return await this.database.getWatchtime(platform, channel);
	}

	async getAllWatchtimePaginated(platform: PlatformType, page: number, pageSize: number): Promise<WatchtimeRecord[]> {
		return await this.database.getAllWatchtimePaginated(platform, page, pageSize);
	}

	async importWatchtime(platform: PlatformType, username: string, time: number): Promise<WatchtimeRecord | null> {
		const now = Date.now();
		const normalizedUsername = username.toLowerCase();
		const id = this.createChannelKey(platform, normalizedUsername);

		const watchtimeRecord: WatchtimeRecord = {
			id,
			platform,
			username: normalizedUsername,
			time,
			firstUpdate: now,
			lastUpdate: now,
		};

		await this.database.setWatchtime(watchtimeRecord);
		return await this.database.getWatchtime(platform, normalizedUsername);
	}

	stop(): void {
		if (this.updateInterval) {
			clearInterval(this.updateInterval);
			this.updateInterval = null;
		}
		this.logger.info("Watchtime service stopped");
	}
}
