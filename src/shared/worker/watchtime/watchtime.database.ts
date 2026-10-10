import { Database } from "$shared/worker/database/database.ts";
import { WatchtimeDatabaseMigrator } from "$shared/worker/watchtime/watchtime.database-migrator.ts";
import { createWatchtimeId } from "$shared/worker/watchtime/watchtime.utils.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { WatchtimeChannel, WatchtimeRecord } from "$types/shared/worker/worker.types.ts";

export class WatchtimeDatabase extends Database {
	protected readonly dbName = "enhancer_watchtime";
	protected readonly dbVersion = 4;
	private readonly storeName = "watchtime";

	private readonly migrator = new WatchtimeDatabaseMigrator(this.storeName, this.logger);

	constructor() {
		super("watchtime-db");
	}

	protected onUpgrade(event: IDBVersionChangeEvent, db: IDBDatabase): void {
		this.migrator.migrate(event, db, this.dbVersion);
	}

	async getWatchtime(platform: PlatformType, username: string): Promise<WatchtimeRecord | null> {
		const id = createWatchtimeId(platform, username);
		const result = await this.request<WatchtimeRecord | undefined>(this.storeName, "readonly", (store) =>
			store.get(id),
		);
		return result ?? null;
	}

	addWatchtime(entries: WatchtimeChannel[], timeToAdd: number): Promise<void> {
		const db = this.requireDatabase();
		const now = Date.now();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(this.storeName, "readwrite");
			const store = tx.objectStore(this.storeName);
			for (const { platform, username } of entries) {
				const normalizedUsername = username.toLowerCase();
				const id = createWatchtimeId(platform, normalizedUsername);
				const request = store.get(id);
				request.onsuccess = () => {
					const existing = request.result as WatchtimeRecord | undefined;
					const watchtime: WatchtimeRecord = existing
						? { ...existing, time: existing.time + timeToAdd, lastUpdate: now }
						: { id, platform, username: normalizedUsername, time: timeToAdd, firstUpdate: now, lastUpdate: now };
					store.put(watchtime);
				};
			}
			tx.oncomplete = () => resolve();
			tx.onerror = () => {
				this.logger.error("Database batch update failed:", tx.error);
				reject(tx.error);
			};
			tx.onabort = () => reject(tx.error);
		});
	}

	async getAllWatchtimePaginated(platform: PlatformType, page: number, pageSize: number): Promise<WatchtimeRecord[]> {
		if (pageSize <= 0) {
			throw new Error("Page size must be a positive number");
		}

		const results: WatchtimeRecord[] = [];
		let skipped = 0;
		const start = (page - 1) * pageSize;

		const range = IDBKeyRange.bound([platform, 0], [platform, Number.POSITIVE_INFINITY]);

		await this.forEachCursor<WatchtimeRecord>(this.storeName, "by_platform_time", range, "prev", (value) => {
			if (skipped >= start && results.length < pageSize) {
				results.push(value);
			}
			skipped++;
			return results.length < pageSize;
		});

		return results;
	}

	async setWatchtime(watchtime: WatchtimeRecord): Promise<void> {
		await this.request<void>(this.storeName, "readwrite", (store) => store.put(watchtime));
	}
}
