import { Logger } from "$shared/logger/logger.ts";
import { WatchtimeDatabaseMigrator } from "$shared/worker/watchtime/watchtime.database-migrator.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { WatchtimeRecord } from "$types/shared/worker/worker.types.ts";

export class WatchtimeDatabase {
	private readonly logger = new Logger({ context: "watchtime-db" });
	private database: IDBDatabase | null = null;
	private readonly dbName = "enhancer_watchtime";
	private readonly dbVersion = 4;
	private readonly storeName = "watchtime";

	private readonly migrator = new WatchtimeDatabaseMigrator(this.storeName, this.logger);

	async initialize(): Promise<void> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, this.dbVersion);

			request.onerror = () => {
				this.logger.error("Failed to open database:", request.error);
				reject(request.error);
			};

			request.onsuccess = () => {
				this.database = request.result;
				this.logger.info("Watchtime database loaded successfully");
				resolve();
			};

			request.onupgradeneeded = (event) => {
				this.migrator.migrate(event, request.result, this.dbVersion);
			};
		});
	}

	private createId(platform: PlatformType, username: string): string {
		return `${platform}:${username.toLowerCase()}`;
	}

	async getWatchtime(platform: PlatformType, username: string): Promise<WatchtimeRecord | null> {
		if (!this.database) {
			throw new Error("Database not initialized");
		}
		const id = this.createId(platform, username);
		return new Promise((resolve, reject) => {
			// biome-ignore lint/style/noNonNullAssertion: checking it above
			const tx = this.database!.transaction(this.storeName, "readonly");
			const store = tx.objectStore(this.storeName);
			const request = store.get(id);

			request.onsuccess = () => resolve(request.result || null);
			request.onerror = () => {
				this.logger.error("Failed to get watchtime:", request.error);
				reject(request.error);
			};
		});
	}

	async addWatchtime(platform: PlatformType, username: string, timeToAdd: number): Promise<void> {
		if (!this.database) {
			throw new Error("Database not initialized");
		}
		const now = Date.now();
		const normalizedUsername = username.toLowerCase();
		const id = this.createId(platform, normalizedUsername);
		let watchtime = await this.getWatchtime(platform, normalizedUsername);
		if (watchtime) {
			watchtime.time += timeToAdd;
			watchtime.lastUpdate = now;
		} else {
			watchtime = {
				id,
				platform,
				username: normalizedUsername,
				time: timeToAdd,
				firstUpdate: now,
				lastUpdate: now,
			};
		}
		return new Promise((resolve, reject) => {
			// biome-ignore lint/style/noNonNullAssertion: checking it above
			const tx = this.database!.transaction(this.storeName, "readwrite");
			const store = tx.objectStore(this.storeName);
			const request = store.put(watchtime);

			request.onsuccess = () => resolve();
			request.onerror = () => {
				this.logger.error("Failed to update watchtime:", request.error);
				reject(request.error);
			};
		});
	}

	async getAllWatchtimePaginated(platform: PlatformType, page: number, pageSize: number): Promise<WatchtimeRecord[]> {
		if (!this.database) {
			throw new Error("Database not initialized");
		}
		if (pageSize <= 0) {
			throw new Error("Page size must be a positive number");
		}

		return new Promise((resolve, reject) => {
			// biome-ignore lint/style/noNonNullAssertion: checking it above
			const tx = this.database!.transaction(this.storeName, "readonly");
			const store = tx.objectStore(this.storeName);
			const index = store.index("by_platform_time");

			const range = IDBKeyRange.bound([platform, 0], [platform, Number.POSITIVE_INFINITY]);
			const request = index.openCursor(range, "prev"); // biggest watchtime first

			const results: WatchtimeRecord[] = [];
			let skipped = 0;
			const start = (page - 1) * pageSize;

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
				if (!cursor) {
					resolve(results);
					return;
				}

				if (skipped >= start && results.length < pageSize) {
					results.push(cursor.value as WatchtimeRecord);
				}

				skipped++;
				if (results.length < pageSize) {
					cursor.continue();
				} else {
					resolve(results);
				}
			};

			request.onerror = () => {
				this.logger.error("Failed to get paginated watchtime by platform:", request.error);
				reject(request.error);
			};
		});
	}
}
