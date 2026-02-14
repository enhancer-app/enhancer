import { Logger } from "$shared/logger/logger.ts";
import { KickStatusScraper } from "$shared/worker/shared-followers/scrapers/kick-status.scraper.ts";
import type { PlatformStatusScraper } from "$shared/worker/shared-followers/scrapers/platform-status.scraper.ts";
import { TwitchStatusScraper } from "$shared/worker/shared-followers/scrapers/twitch-status.scraper.ts";
import type { SharedStorageService } from "$shared/worker/shared-storage/shared-storage.service.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { LiveStreamerEntry, SharedFollower } from "$types/shared/worker/shared-storage.types.ts";

export class SharedFollowersService {
	private readonly logger = new Logger({ context: "shared-followers-service" });

	private liveStreamersCache: LiveStreamerEntry[] = [];
	private tickInterval: ReturnType<typeof setInterval> | null = null;
	private rotationIndex = 0;
	private isProcessing = false;

	/** Per-platform status scrapers, keyed by platform type. */
	private readonly scrapers: Map<PlatformType, PlatformStatusScraper>;

	// ── Scheduling constants ──

	/** How often the scheduler runs (1 minute). */
	static readonly TICK_INTERVAL_MS = 60_000;

	/** Slots filled by weighted priority score. */
	static readonly PRIORITY_BUDGET = 7;

	/** Slots reserved for round-robin rotation (guarantees no streamer is starved). */
	static readonly ROTATION_BUDGET = 3;

	// ── Priority weights ──

	/** Weight multiplier for currently live streamers. */
	static readonly LIVE_WEIGHT = 3;

	/** Weight multiplier for streamers who were live in the last 2 weeks. */
	static readonly RECENT_WEIGHT = 2;

	/** Weight multiplier for offline / inactive streamers. */
	static readonly DEFAULT_WEIGHT = 1;

	/** Minimum interval before re-checking a Tier 1 (recently live) streamer. */
	static readonly TIER_1_MIN_INTERVAL_MS = 2 * 60 * 1000;

	/** Minimum interval before re-checking a Tier 2 (currently live) streamer. */
	static readonly TIER_2_MIN_INTERVAL_MS = 3 * 60 * 1000;

	/** Two weeks in milliseconds. */
	static readonly TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

	constructor(private readonly sharedStorageService: SharedStorageService) {
		this.scrapers = new Map<PlatformType, PlatformStatusScraper>([
			["kick", new KickStatusScraper()],
			["twitch", new TwitchStatusScraper()],
		]);
	}

	async initialize(): Promise<void> {
		await this.loadPersistedCache();
		this.startTickInterval();
		this.logger.info("Shared followers service initialized");
	}

	getLiveStreamersCache(): LiveStreamerEntry[] {
		return this.liveStreamersCache;
	}

	stop(): void {
		if (this.tickInterval) {
			clearInterval(this.tickInterval);
			this.tickInterval = null;
		}
		this.logger.info("Shared followers service stopped");
	}

	// ── Initialization helpers ──

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

	private startTickInterval(): void {
		this.tickInterval = setInterval(async () => {
			await this.tick();
		}, SharedFollowersService.TICK_INTERVAL_MS);
	}

	// ── Core scheduling logic ──

	private async tick(): Promise<void> {
		if (this.isProcessing) {
			this.logger.debug("Skipping tick: previous tick still in progress");
			return;
		}

		this.isProcessing = true;

		try {
			const allFollowers = await this.getAllFollowers();
			if (allFollowers.length === 0) return;

			this.syncCacheWithFollowers(allFollowers);

			const toCheck = this.selectStreamersToCheck();

			if (toCheck.length === 0) {
				this.logger.debug("No streamers due for checking this tick");
				return;
			}

			this.logger.debug(`Checking ${toCheck.length} streamers this tick`);

			await this.checkStreamersInBatches(toCheck);

			await this.persistCache();

			const liveCount = this.liveStreamersCache.filter((s) => s.isLive).length;
			this.logger.debug(
				`Tick complete: checked ${toCheck.length}, ${liveCount}/${this.liveStreamersCache.length} live`,
			);
		} catch (error) {
			this.logger.error("Failed during tick:", error);
		} finally {
			this.isProcessing = false;
		}
	}

	/**
	 * Selects which streamers to check this tick using the budget-based
	 * priority + rotation strategy.
	 *
	 * - Priority slots: filled by streamers with the highest weighted staleness score,
	 *   respecting minimum re-check intervals per priority class.
	 * - Rotation slots: round-robin through all streamers regardless of score,
	 *   guaranteeing that no streamer is ever starved of checks.
	 */
	private selectStreamersToCheck(): LiveStreamerEntry[] {
		const now = Date.now();
		const selected = new Set<string>();
		const result: LiveStreamerEntry[] = [];

		// ── Priority slots ──
		const priorityCandidates = this.liveStreamersCache
			.filter((entry) => this.isEligibleForPriorityCheck(entry, now))
			.map((entry) => ({
				entry,
				score: this.calculatePriorityScore(entry, now),
			}))
			.sort((a, b) => b.score - a.score);

		for (const { entry } of priorityCandidates) {
			if (result.length >= SharedFollowersService.PRIORITY_BUDGET) break;

			const key = this.entryKey(entry);
			if (!selected.has(key)) {
				selected.add(key);
				result.push(entry);
			}
		}

		// ── Rotation slots ──
		const cacheLength = this.liveStreamersCache.length;
		if (cacheLength > 0) {
			let rotationAdded = 0;
			let attempts = 0;

			while (rotationAdded < SharedFollowersService.ROTATION_BUDGET && attempts < cacheLength) {
				const index = this.rotationIndex % cacheLength;
				this.rotationIndex = (this.rotationIndex + 1) % cacheLength;
				attempts++;

				const entry = this.liveStreamersCache[index];
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

	/**
	 * Calculates the weighted staleness score for a cache entry.
	 *
	 * Higher score = more urgently needs checking.
	 * Score = (time since last check) * weight multiplier
	 */
	private calculatePriorityScore(entry: LiveStreamerEntry, now: number): number {
		const staleness = now - entry.lastChecked;
		const weight = this.getWeight(entry, now);
		return staleness * weight;
	}

	/**
	 * Determines the weight multiplier for an entry based on its status.
	 *
	 * - Currently live → LIVE_WEIGHT (3x)
	 * - Was live within the last 2 weeks → RECENT_WEIGHT (2x)
	 * - Otherwise → DEFAULT_WEIGHT (1x)
	 */
	private getWeight(entry: LiveStreamerEntry, now: number): number {
		if (entry.isLive) {
			return SharedFollowersService.LIVE_WEIGHT;
		}

		if (entry.lastLiveAt && now - entry.lastLiveAt < SharedFollowersService.TWO_WEEKS_MS) {
			return SharedFollowersService.RECENT_WEIGHT;
		}

		return SharedFollowersService.DEFAULT_WEIGHT;
	}

	/**
	 * Checks whether an entry is eligible for a priority check based on
	 * minimum re-check intervals. This prevents wasting budget on entries
	 * that were just checked.
	 */
	private isEligibleForPriorityCheck(entry: LiveStreamerEntry, now: number): boolean {
		if (entry.lastChecked === 0) return true;

		const elapsed = now - entry.lastChecked;
		const weight = this.getWeight(entry, now);

		if (weight === SharedFollowersService.LIVE_WEIGHT) {
			return elapsed >= SharedFollowersService.TIER_2_MIN_INTERVAL_MS;
		}

		if (weight === SharedFollowersService.RECENT_WEIGHT) {
			return elapsed >= SharedFollowersService.TIER_1_MIN_INTERVAL_MS;
		}

		// Default weight entries are always eligible for priority picks
		// (their low weight naturally keeps them from dominating the priority queue)
		return true;
	}

	// ── Batch processing ──

	/**
	 * Groups the selected streamers by platform, then calls each platform's
	 * scraper in chunks of its maxBatchSize.
	 *
	 * - For Kick (maxBatchSize=1), this means sequential per-channel calls
	 *   with a delay handled internally by the scraper.
	 * - For Twitch (maxBatchSize=30), up to 30 channels are checked in a
	 *   single API call.
	 */
	private async checkStreamersInBatches(entries: LiveStreamerEntry[]): Promise<void> {
		// Group entries by platform
		const grouped = new Map<PlatformType, LiveStreamerEntry[]>();
		for (const entry of entries) {
			const group = grouped.get(entry.platform) ?? [];
			group.push(entry);
			grouped.set(entry.platform, group);
		}

		// Process each platform's group
		for (const [platform, platformEntries] of grouped) {
			const scraper = this.scrapers.get(platform);
			if (!scraper) {
				this.logger.warn(`No scraper registered for platform: ${platform}`);
				continue;
			}

			// Split into chunks of maxBatchSize
			const chunks = this.chunk(
				platformEntries.map((e) => e.channelId),
				scraper.maxBatchSize,
			);

			for (const channelIds of chunks) {
				const results = await scraper.checkStatusBatch(channelIds);

				// Apply results back to the cache entries
				for (const entry of platformEntries) {
					const result = results.get(entry.channelId);
					if (!result) continue;

					entry.isLive = result.isLive;
					entry.gameName = result.gameName;
					entry.viewerCount = result.viewerCount;
					entry.startedAt = result.startedAt;
					entry.lastChecked = Date.now();

					if (result.isLive) {
						entry.lastLiveAt = Date.now();
					}
				}
			}
		}
	}

	// ── Data management ──

	/**
	 * Reads all followers from both platform storage keys and merges them.
	 */
	private async getAllFollowers(): Promise<SharedFollower[]> {
		const [twitchFollowers, kickFollowers] = await Promise.all([
			this.sharedStorageService.get("sharedFollowers.twitch"),
			this.sharedStorageService.get("sharedFollowers.kick"),
		]);

		return [...(twitchFollowers ?? []), ...(kickFollowers ?? [])];
	}

	/**
	 * Synchronizes the in-memory cache with the current follower list.
	 *
	 * - Adds new followers with default (unchecked) status.
	 * - Removes entries for channels that are no longer in the follower list.
	 * - Preserves existing cache data for channels that are still followed.
	 */
	private syncCacheWithFollowers(followers: SharedFollower[]): void {
		const followerKeys = new Set(followers.map((f) => `${f.platform}:${f.channelId}`));
		const cacheMap = new Map(this.liveStreamersCache.map((entry) => [this.entryKey(entry), entry]));

		// Add new followers that aren't in the cache yet
		for (const follower of followers) {
			const key = `${follower.platform}:${follower.channelId}`;
			if (!cacheMap.has(key)) {
				cacheMap.set(key, {
					channelId: follower.channelId,
					platform: follower.platform,
					username: follower.username,
					isLive: false,
					gameName: null,
					viewerCount: 0,
					thumbnailUrl: null,
					startedAt: null,
					lastChecked: 0,
					lastLiveAt: null,
				});
			}
		}

		// Remove entries that are no longer in the follower list
		for (const key of cacheMap.keys()) {
			if (!followerKeys.has(key)) {
				cacheMap.delete(key);
			}
		}

		this.liveStreamersCache = Array.from(cacheMap.values());
	}

	/**
	 * Persists the current live streamers cache to shared storage.
	 */
	private async persistCache(): Promise<void> {
		try {
			await this.sharedStorageService.set("sharedFollowers.liveCache", this.liveStreamersCache);
		} catch (error) {
			this.logger.warn("Failed to persist live streamers cache:", error);
		}
	}

	// ── Utilities ──

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
