import { Logger } from "$shared/logger/logger.ts";
import { SharedStorageDatabase } from "$shared/worker/shared-storage/shared-storage.database.ts";
import type {
	LiveStreamerEntry,
	SharedFollower,
	SharedStorageKey,
	SharedStorageKeys,
} from "$types/shared/worker/shared-storage.types.ts";

export class SharedStorageService {
	private readonly logger = new Logger({ context: "shared-storage-service" });
	private readonly database = new SharedStorageDatabase();

	private liveStreamersCache: LiveStreamerEntry[] = [];
	private pollingInterval: ReturnType<typeof setInterval> | null = null;

	/** Polling interval in milliseconds (5 minutes) */
	static readonly POLLING_INTERVAL_MS = 5 * 60 * 1000;

	async initialize(): Promise<void> {
		await this.database.initialize();
		this.startPollingInterval();
		this.logger.info("Shared storage service initialized");
	}

	async get<K extends SharedStorageKey>(key: K): Promise<SharedStorageKeys[K] | null> {
		const value = await this.database.get(key);
		return value as SharedStorageKeys[K] | null;
	}

	async set<K extends SharedStorageKey>(key: K, value: SharedStorageKeys[K]): Promise<void> {
		await this.database.set(key, value);
		this.logger.debug(`Shared storage updated for key: ${key}`);
	}

	getLiveStreamersCache(): LiveStreamerEntry[] {
		return this.liveStreamersCache;
	}

	stop(): void {
		if (this.pollingInterval) {
			clearInterval(this.pollingInterval);
			this.pollingInterval = null;
		}
		this.logger.info("Shared storage service stopped");
	}

	private startPollingInterval(): void {
		this.pollingInterval = setInterval(async () => {
			try {
				await this.updateLiveStreamersCache();
			} catch (error) {
				this.logger.error("Failed to update live streamers cache:", error);
			}
		}, SharedStorageService.POLLING_INTERVAL_MS);
	}

	/**
	 * Reads follower lists from all platform keys in shared storage,
	 * checks each one's stream status, and updates the live streamers cache.
	 */
	private async updateLiveStreamersCache(): Promise<void> {
		const twitchFollowers = (await this.get("sharedFollowers.twitch")) ?? [];
		const kickFollowers = (await this.get("sharedFollowers.kick")) ?? [];
		const allFollowers: SharedFollower[] = [...twitchFollowers, ...kickFollowers];

		if (allFollowers.length === 0) return;

		this.logger.debug(`Checking stream status for ${allFollowers.length} followers`);

		const updatedCache: LiveStreamerEntry[] = [];

		for (const follower of allFollowers) {
			const isLive = await this.checkStreamStatus(follower.channelId);
			updatedCache.push({
				channelId: follower.channelId,
				platform: follower.platform,
				username: follower.username,
				isLive,
				lastChecked: Date.now(),
			});
		}

		this.liveStreamersCache = updatedCache;
		this.logger.debug(
			`Live streamers cache updated: ${updatedCache.filter((s) => s.isLive).length}/${updatedCache.length} live`,
		);
	}

	/**
	 * Checks whether a given channel is currently live.
	 *
	 * TODO: Implement actual API calls to Twitch/Kick to check stream status.
	 * This stub always returns false until the real logic is implemented.
	 */
	private async checkStreamStatus(_channelId: string): Promise<boolean> {
		// TODO: Implement platform-specific API calls to determine live status.
		// For Twitch, this could use the Twitch Helix API (GET /streams?user_login=...).
		// For Kick, this could use the Kick API (GET /api/v2/channels/{slug}).
		return false;
	}
}
