import { Database } from "$shared/worker/database/database.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type {
	ChannelStatusRecord,
	CrossPlatformFollowsRecord,
} from "$types/shared/worker/cross-platform-follows-worker.types.ts";
import type { ChannelPinRecord } from "$types/shared/worker/pins-worker.types.ts";

export class SharedDatabase extends Database {
	protected readonly dbName = "enhancer_shared";
	protected readonly dbVersion = 1;
	private readonly followsStore = "follows";
	private readonly statusesStore = "statuses";
	private readonly pinsStore = "pins";

	constructor() {
		super("shared-db");
	}

	protected onUpgrade(_event: IDBVersionChangeEvent, db: IDBDatabase): void {
		if (!db.objectStoreNames.contains(this.followsStore)) {
			db.createObjectStore(this.followsStore, { keyPath: "platform" });
		}
		if (!db.objectStoreNames.contains(this.statusesStore)) {
			const store = db.createObjectStore(this.statusesStore, { keyPath: "id" });
			store.createIndex("platform", "platform", { unique: false });
		}
		if (!db.objectStoreNames.contains(this.pinsStore)) {
			const store = db.createObjectStore(this.pinsStore, { keyPath: "id" });
			store.createIndex("platform", "platform", { unique: false });
		}
	}

	async getFollows(platform: PlatformType): Promise<CrossPlatformFollowsRecord | null> {
		const record = await this.request<CrossPlatformFollowsRecord | undefined>(this.followsStore, "readonly", (store) =>
			store.get(platform),
		);
		return record ?? null;
	}

	async putFollows(record: CrossPlatformFollowsRecord): Promise<void> {
		await this.request(this.followsStore, "readwrite", (store) => store.put(record));
	}

	async getStatuses(platform: PlatformType): Promise<ChannelStatusRecord[]> {
		return this.request<ChannelStatusRecord[]>(this.statusesStore, "readonly", (store) =>
			store.index("platform").getAll(platform),
		);
	}

	async replaceStatuses(platform: PlatformType, statuses: ChannelStatusRecord[]): Promise<void> {
		await this.transaction([this.statusesStore], (tx) => {
			const store = tx.objectStore(this.statusesStore);
			store.index("platform").openKeyCursor(platform).onsuccess = (event) => {
				const cursor = (event.target as IDBRequest<IDBCursor | null>).result;
				if (!cursor) {
					for (const status of statuses) store.put(status);
					return;
				}
				store.delete(cursor.primaryKey);
				cursor.continue();
			};
		});
	}

	async deleteStatus(platform: PlatformType, login: string): Promise<void> {
		await this.request(this.statusesStore, "readwrite", (store) => store.delete(`${platform}:${login}`));
	}

	async getPins(platform: PlatformType): Promise<ChannelPinRecord[]> {
		return this.request<ChannelPinRecord[]>(this.pinsStore, "readonly", (store) =>
			store.index("platform").getAll(platform),
		);
	}

	async setPins(platform: PlatformType, logins: string[], pinned: boolean): Promise<void> {
		const now = Date.now();
		await this.transaction([this.pinsStore], (tx) => {
			const store = tx.objectStore(this.pinsStore);
			for (const login of logins) {
				const id = `${platform}:${login}`;
				if (pinned) store.put({ id, platform, login, pinnedAt: now } satisfies ChannelPinRecord);
				else store.delete(id);
			}
		});
	}

	async clear(platform: PlatformType): Promise<boolean> {
		const existing = await this.getFollows(platform);
		const statuses = await this.getStatuses(platform);
		if (!existing && statuses.length === 0) return false;

		await this.transaction([this.followsStore, this.statusesStore], (tx) => {
			tx.objectStore(this.followsStore).delete(platform);
			const store = tx.objectStore(this.statusesStore);
			for (const status of statuses) store.delete(status.id);
		});
		return true;
	}

	private transaction(storeNames: string[], fn: (tx: IDBTransaction) => void): Promise<void> {
		const db = this.requireDatabase();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(storeNames, "readwrite");
			tx.oncomplete = () => resolve();
			tx.onerror = () => {
				this.logger.error("Database transaction failed:", tx.error);
				reject(tx.error);
			};
			tx.onabort = () => reject(tx.error);
			fn(tx);
		});
	}
}
