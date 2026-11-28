import type {
	AccountCacheStorage,
	EnhancerAccountSnapshot,
	StoredAccountSnapshot,
} from "$types/shared/worker/enhancer-account-worker.types.ts";

// Builds before the cache was encrypted kept a plaintext copy in chrome.storage.local.
export const LEGACY_STORAGE_KEY = "enhancerAccountCache";

function isStoredSnapshot(value: unknown): value is StoredAccountSnapshot {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as StoredAccountSnapshot).owner === "string" &&
		typeof (value as StoredAccountSnapshot).updatedAt === "number"
	);
}

export class EnhancerAccountCache {
	private writes: Promise<void> = Promise.resolve();

	constructor(private readonly storage: AccountCacheStorage) {}

	async read(owner: string): Promise<EnhancerAccountSnapshot> {
		await this.writes.catch(() => {});
		const stored = await this.storage.get().catch(() => undefined);
		if (!isStoredSnapshot(stored) || stored.owner !== owner) return { updatedAt: 0 };
		const { owner: _owner, ...snapshot } = stored;
		return snapshot;
	}

	write(owner: string, patch: Omit<EnhancerAccountSnapshot, "updatedAt">): Promise<void> {
		this.writes = this.writes
			.catch(() => {})
			.then(async () => {
				const stored = await this.storage.get().catch(() => undefined);
				const base = isStoredSnapshot(stored) && stored.owner === owner ? stored : { owner };
				await this.storage.set({ ...base, ...patch, owner, updatedAt: Date.now() });
			});
		return this.writes.catch(() => {});
	}

	clear(): Promise<void> {
		this.writes = this.writes.catch(() => {}).then(() => this.storage.remove());
		return this.writes.catch(() => {});
	}
}
