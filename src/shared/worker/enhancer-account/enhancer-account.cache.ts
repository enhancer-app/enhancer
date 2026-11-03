import type {
	AccountCacheStorage,
	EnhancerAccountSnapshot,
	StoredAccountSnapshot,
} from "$types/shared/worker/enhancer-account-worker.types.ts";

const STORAGE_KEY = "enhancerAccountCache";

const chromeLocalStorage: AccountCacheStorage = {
	get: async (key) => (await chrome.storage.local.get(key))[key],
	set: (key, value) => chrome.storage.local.set({ [key]: value }),
	remove: (key) => chrome.storage.local.remove(key),
};

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

	constructor(private readonly storage: AccountCacheStorage = chromeLocalStorage) {}

	async read(owner: string): Promise<EnhancerAccountSnapshot> {
		await this.writes.catch(() => {});
		const stored = await this.storage.get(STORAGE_KEY).catch(() => undefined);
		if (!isStoredSnapshot(stored) || stored.owner !== owner) return { updatedAt: 0 };
		const { owner: _owner, ...snapshot } = stored;
		return snapshot;
	}

	write(owner: string, patch: Omit<EnhancerAccountSnapshot, "updatedAt">): Promise<void> {
		this.writes = this.writes
			.catch(() => {})
			.then(async () => {
				const stored = await this.storage.get(STORAGE_KEY).catch(() => undefined);
				const base = isStoredSnapshot(stored) && stored.owner === owner ? stored : { owner };
				await this.storage.set(STORAGE_KEY, { ...base, ...patch, owner, updatedAt: Date.now() });
			});
		return this.writes.catch(() => {});
	}

	clear(): Promise<void> {
		this.writes = this.writes.catch(() => {}).then(() => this.storage.remove(STORAGE_KEY));
		return this.writes.catch(() => {});
	}
}
