import { parseChangelogFeed, selectLatestEntry } from "$shared/changelog/changelog.utils.ts";
import type { ChangelogEntry, ChangelogFeedCache, ChangelogFeedDependencies } from "$types/shared/changelog.types.ts";

export const CHANGELOG_CACHE_KEY = "enhancer.changelog.feed";
export const CHANGELOG_PENDING_SEEN_KEY = "enhancer.changelog.pending-seen";
export const CHANGELOG_CACHE_TTL = 6 * 60 * 60 * 1000;
export const CHANGELOG_RETRY_DELAY = 30 * 60 * 1000;

export async function fetchChangelogFeed(url: string): Promise<unknown> {
	const response = await fetch(url, { cache: "no-cache", credentials: "omit" });
	if (!response.ok) throw new Error(`Changelog feed returned ${response.status}`);
	return response.json();
}

export class ChangelogFeed {
	private inflight: Promise<ChangelogEntry[]> | null = null;

	constructor(private readonly deps: ChangelogFeedDependencies) {}

	async getEntries(force = false): Promise<ChangelogEntry[]> {
		const cache = await this.readCache();
		const now = this.now();
		if (!force && cache) {
			if (cache.fetchedAt !== undefined && now - cache.fetchedAt < CHANGELOG_CACHE_TTL) return cache.entries;
			if (cache.failedAt !== undefined && now - cache.failedAt < CHANGELOG_RETRY_DELAY) return cache.entries;
		}
		this.inflight ??= this.refresh(cache).finally(() => {
			this.inflight = null;
		});
		return this.inflight;
	}

	async getLatest(): Promise<ChangelogEntry | null> {
		const latest = selectLatestEntry(await this.getEntries(), this.deps.version);
		if (!latest || !(await this.hasPendingSeen())) return latest;
		await this.deps.markSeen(latest.id);
		await this.deps.storage.remove(CHANGELOG_PENDING_SEEN_KEY).catch(() => {});
		return null;
	}

	async handleInstalled(reason: string): Promise<void> {
		if (reason !== "install" && reason !== "update") return;
		const entries = await this.getEntries(true);
		if (reason === "update") return;
		const latest = selectLatestEntry(entries, this.deps.version);
		if (latest) await this.deps.markSeen(latest.id);
		else if (entries.length === 0) await this.deps.storage.set({ [CHANGELOG_PENDING_SEEN_KEY]: true });
	}

	private async refresh(cache: ChangelogFeedCache | null): Promise<ChangelogEntry[]> {
		try {
			const entries = parseChangelogFeed(await this.deps.fetchFeed());
			await this.writeCache({ entries, fetchedAt: this.now() });
			return entries;
		} catch {
			const entries = cache?.entries ?? [];
			await this.writeCache({ ...cache, entries, failedAt: this.now() });
			return entries;
		}
	}

	private async readCache(): Promise<ChangelogFeedCache | null> {
		try {
			const stored = (await this.deps.storage.get(CHANGELOG_CACHE_KEY))[CHANGELOG_CACHE_KEY];
			if (typeof stored !== "object" || stored === null) return null;
			const cache = stored as Partial<ChangelogFeedCache>;
			return {
				entries: parseChangelogFeed(cache.entries),
				...(typeof cache.fetchedAt === "number" && { fetchedAt: cache.fetchedAt }),
				...(typeof cache.failedAt === "number" && { failedAt: cache.failedAt }),
			};
		} catch {
			return null;
		}
	}

	private async writeCache(cache: ChangelogFeedCache): Promise<void> {
		await this.deps.storage.set({ [CHANGELOG_CACHE_KEY]: cache }).catch(() => {});
	}

	private async hasPendingSeen(): Promise<boolean> {
		try {
			return (await this.deps.storage.get(CHANGELOG_PENDING_SEEN_KEY))[CHANGELOG_PENDING_SEEN_KEY] === true;
		} catch {
			return false;
		}
	}

	private now(): number {
		return (this.deps.now ?? Date.now)();
	}
}
