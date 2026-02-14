import { Logger } from "$shared/logger/logger.ts";
import { KickStatusScraper } from "$shared/worker/shared-followers/scrapers/kick-status.scraper.ts";
import type { PlatformStatusScraper } from "$shared/worker/shared-followers/scrapers/platform-status.scraper.ts";
import { TwitchStatusScraper } from "$shared/worker/shared-followers/scrapers/twitch-status.scraper.ts";
import type { SharedStorageService } from "$shared/worker/shared-storage/shared-storage.service.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { LiveStreamerEntry, SharedFollower } from "$types/shared/worker/shared-storage.types.ts";

export interface PlatformScheduleConfig {
	tickInterval: number;
	priorityBudget: number;
	rotationBudget: number;
	minIntervalMs: {
		live: number;
		recent: number;
		default: number;
	};
}

export const PLATFORM_CONFIGS: Record<PlatformType, PlatformScheduleConfig> = {
	twitch: {
		tickInterval: 5_000,
		priorityBudget: 30,
		rotationBudget: 3,
		minIntervalMs: {
			live: 30_000,
			recent: 20_000,
			default: 10_000,
		},
	},
	kick: {
		tickInterval: 2_000,
		priorityBudget: 1,
		rotationBudget: 1,
		minIntervalMs: {
			live: 30_000,
			recent: 20_000,
			default: 10_000,
		},
	},
};

interface PlatformState {
	tickInterval: ReturnType<typeof setInterval> | null;
	rotationIndex: number;
	isProcessing: boolean;
}

export class SharedFollowersService {
	private readonly logger = new Logger({ context: "shared-followers-service" });

	private liveStreamersCache: LiveStreamerEntry[] = [];
	private globalSyncInterval: ReturnType<typeof setInterval> | null = null;
	private readonly platformStates: Map<PlatformType, PlatformState> = new Map();

	private readonly scrapers: Map<PlatformType, PlatformStatusScraper>;

	static readonly TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

	constructor(private readonly sharedStorageService: SharedStorageService) {
		this.scrapers = new Map<PlatformType, PlatformStatusScraper>([
			["kick", new KickStatusScraper()],
			["twitch", new TwitchStatusScraper()],
		]) as Map<PlatformType, PlatformStatusScraper>;

		for (const platform of Object.keys(PLATFORM_CONFIGS) as PlatformType[]) {
			this.platformStates.set(platform, {
				tickInterval: null,
				rotationIndex: 0,
				isProcessing: false,
			});
		}
	}

	async initialize(): Promise<void> {
		await this.loadPersistedCache();
		await this.syncFollowers();
		this.startGlobalSyncInterval();

		for (const platform of Object.keys(PLATFORM_CONFIGS) as PlatformType[]) {
			this.startPlatformTick(platform);
		}

		this.logger.info("Shared followers service initialized");
	}

	getLiveStreamersCache(): LiveStreamerEntry[] {
		return this.liveStreamersCache;
	}

	stop(): void {
		if (this.globalSyncInterval) {
			clearInterval(this.globalSyncInterval);
			this.globalSyncInterval = null;
		}

		for (const [platform, state] of this.platformStates) {
			if (state.tickInterval) {
				clearInterval(state.tickInterval);
				state.tickInterval = null;
			}
		}

		this.logger.info("Shared followers service stopped");
	}

	private async loadPersistedCache(): Promise<void> {
		try {
			const persisted = await this.sharedStorageService.get("sharedFollowers.liveCache");
			if (persisted && Array.isArray(persisted)) {
				this.liveStreamersCache = persisted;
				this.logger.debug(`Loaded ${persisted.length} cached entries from storage`);
			}
		} catch (error) {
			this.logger.warn("Failed to load persisted live cache, starting fresh:", error);
		}
	}

	private startGlobalSyncInterval(): void {
		this.globalSyncInterval = setInterval(async () => {
			await this.syncFollowers();
		}, 60_000);
	}

	private async syncFollowers(): Promise<void> {
		const allFollowers = await this.getAllFollowers();
		if (allFollowers.length === 0) return;
		this.syncCacheWithFollowers(allFollowers);
	}

	private startPlatformTick(platform: PlatformType): void {
		const config = PLATFORM_CONFIGS[platform];
		const state = this.platformStates.get(platform);
		if (!state) return;

		this.tickPlatform(platform);

		state.tickInterval = setInterval(() => {
			this.tickPlatform(platform);
		}, config.tickInterval);
	}

	private async tickPlatform(platform: PlatformType): Promise<void> {
		const state = this.platformStates.get(platform);
		const config = PLATFORM_CONFIGS[platform];

		if (!state || !config) {
			this.logger.warn(`No state or config found for platform: ${platform}`);
			return;
		}

		if (state.isProcessing) {
			this.logger.debug(`Skipping ${platform} tick: previous still in progress`);
			return;
		}

		state.isProcessing = true;

		try {
			const platformCache = this.liveStreamersCache.filter((e) => e.platform === platform);

			if (platformCache.length === 0) {
				return;
			}

			const toCheck = this.selectStreamersToCheck(platformCache, config, state);

			if (toCheck.length === 0) {
				this.logger.debug(`No ${platform} streamers due for checking this tick`);
				return;
			}

			this.logger.debug(`[${platform}] Checking ${toCheck.length} streamers`);

			await this.checkStreamersInBatches(toCheck);

			await this.persistCache();

			const liveCount = platformCache.filter((s) => s.isLive).length;
			this.logger.debug(
				`[${platform}] Tick complete: checked ${toCheck.length}, ${liveCount}/${platformCache.length} live`,
			);
		} catch (error) {
			this.logger.error(`Failed during ${platform} tick:`, error);
		} finally {
			state.isProcessing = false;
		}
	}

	private selectStreamersToCheck(
		platformCache: LiveStreamerEntry[],
		config: PlatformScheduleConfig,
		state: PlatformState,
	): LiveStreamerEntry[] {
		const now = Date.now();
		const selected = new Set<string>();
		const result: LiveStreamerEntry[] = [];

		const priorityCandidates = platformCache
			.filter((entry) => this.isEligibleForPriorityCheck(entry, now, config))
			.map((entry) => ({
				entry,
				score: this.calculatePriorityScore(entry, now),
			}))
			.sort((a, b) => b.score - a.score);

		for (const { entry } of priorityCandidates) {
			if (result.length >= config.priorityBudget) break;

			const key = this.entryKey(entry);
			if (!selected.has(key)) {
				selected.add(key);
				result.push(entry);
			}
		}

		if (platformCache.length > 0) {
			let rotationAdded = 0;
			let attempts = 0;

			while (rotationAdded < config.rotationBudget && attempts < platformCache.length) {
				const index = state.rotationIndex % platformCache.length;
				state.rotationIndex = (state.rotationIndex + 1) % platformCache.length;
				attempts++;

				const entry = platformCache[index];
				const key = this.entryKey(entry);

				if (!selected.has(key)) {
					selected.add(key);
					result.push(entry);
					rotationAdded++;
				}
			}
		}

		return result;
	}

	private calculatePriorityScore(entry: LiveStreamerEntry, now: number): number {
		const staleness = now - entry.lastChecked;
		const weight = this.getWeight(entry, now);
		return staleness * weight;
	}

	private getWeight(entry: LiveStreamerEntry, now: number): number {
		if (entry.isLive) {
			return 3;
		}

		if (entry.lastLiveAt && now - entry.lastLiveAt < SharedFollowersService.TWO_WEEKS_MS) {
			return 2;
		}

		return 1;
	}

	private isEligibleForPriorityCheck(entry: LiveStreamerEntry, now: number, config: PlatformScheduleConfig): boolean {
		if (entry.lastChecked === 0) return true;

		const elapsed = now - entry.lastChecked;
		const weight = this.getWeight(entry, now);

		if (weight === 3) {
			return elapsed >= config.minIntervalMs.live;
		}

		if (weight === 2) {
			return elapsed >= config.minIntervalMs.recent;
		}

		return elapsed >= config.minIntervalMs.default;
	}

	private async checkStreamersInBatches(entries: LiveStreamerEntry[]): Promise<void> {
		const grouped = new Map<PlatformType, LiveStreamerEntry[]>();
		for (const entry of entries) {
			const group = grouped.get(entry.platform) ?? [];
			group.push(entry);
			grouped.set(entry.platform, group);
		}

		for (const [platform, platformEntries] of grouped) {
			const scraper = this.scrapers.get(platform);
			if (!scraper) {
				this.logger.warn(`No scraper registered for platform: ${platform}`);
				continue;
			}

			const chunks = this.chunk(
				platformEntries.map((e) => e.channelId),
				scraper.maxBatchSize,
			);

			for (const channelIds of chunks) {
				const results = await scraper.checkStatusBatch(channelIds);

				for (const entry of platformEntries) {
					const result = results.get(entry.channelId);
					if (!result) continue;

					entry.displayName = result.displayName;
					entry.isLive = result.isLive;
					entry.gameName = result.gameName;
					entry.gameName = result.title;
					entry.viewerCount = result.viewerCount;
					entry.profilePictureUrl = result.profilePictureUrl;
					entry.startedAt = result.startedAt;
					entry.lastChecked = Date.now();

					if (result.isLive) {
						entry.lastLiveAt = Date.now();
					}
				}
			}
		}
	}

	private async getAllFollowers(): Promise<SharedFollower[]> {
		const [twitchFollowers, kickFollowers] = await Promise.all([
			this.sharedStorageService.get("sharedFollowers.twitch"),
			this.sharedStorageService.get("sharedFollowers.kick"),
		]);

		return [...(twitchFollowers ?? []), ...(kickFollowers ?? [])];
	}

	private syncCacheWithFollowers(followers: SharedFollower[]): void {
		const followerKeys = new Set(followers.map((f) => `${f.platform}:${f.channelId}`));
		const cacheMap = new Map(this.liveStreamersCache.map((entry) => [this.entryKey(entry), entry]));

		for (const follower of followers) {
			const key = `${follower.platform}:${follower.channelId}`;
			if (!cacheMap.has(key)) {
				cacheMap.set(key, {
					displayName: null,
					channelId: follower.channelId,
					platform: follower.platform,
					username: follower.username,
					isLive: false,
					gameName: null,
					title: null,
					viewerCount: 0,
					profilePictureUrl: null,
					startedAt: null,
					lastChecked: 0,
					lastLiveAt: null,
				});
			}
		}

		for (const key of cacheMap.keys()) {
			if (!followerKeys.has(key)) {
				cacheMap.delete(key);
			}
		}

		this.liveStreamersCache = Array.from(cacheMap.values());
	}

	private async persistCache(): Promise<void> {
		try {
			await this.sharedStorageService.set("sharedFollowers.liveCache", this.liveStreamersCache);
		} catch (error) {
			this.logger.warn("Failed to persist live streamers cache:", error);
		}
	}

	private entryKey(entry: LiveStreamerEntry): string {
		return `${entry.platform}:${entry.channelId}`;
	}

	private chunk<T>(array: T[], size: number): T[][] {
		const chunks: T[][] = [];
		for (let i = 0; i < array.length; i += size) {
			chunks.push(array.slice(i, i + size));
		}
		return chunks;
	}
}
