import { Logger } from "$shared/logger/logger.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { WatchtimeRecord } from "$types/shared/worker/worker.types.ts";

export class WatchtimeDatabase {
	private readonly logger = new Logger({ context: "watchtime-db" });
	private database: IDBDatabase | null = null;
	private readonly dbName = "enhancer_watchtime";
	private readonly dbVersion = 2;
	private readonly storeName = "watchtime";

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
				this.handleUpgrade(event);
			};
		});
	}

	private handleUpgrade(event: IDBVersionChangeEvent): void {
		if (event.oldVersion === 1 && event.newVersion === 2) return;
		const db = (event.target as IDBOpenDBRequest).result;
		this.logger.info(`Creating watchtime database (version ${this.dbVersion})...`);
		const store = db.createObjectStore(this.storeName, { keyPath: "id" });
		store.createIndex("by_platform", "platform");
		store.createIndex("by_username", "username");
		store.createIndex("by_platform_username", ["platform", "username"], { unique: true });
		store.createIndex("by_time", "time");
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

	async getAllWatchtimeByPlatform(platform: PlatformType): Promise<WatchtimeRecord[]> {
		if (!this.database) {
			throw new Error("Database not initialized");
		}
		return new Promise((resolve, reject) => {
			// biome-ignore lint/style/noNonNullAssertion: checking it above
			const tx = this.database!.transaction(this.storeName, "readonly");
			const store = tx.objectStore(this.storeName);
			const index = store.index("by_platform");
			const request = index.getAll(platform);

			request.onsuccess = () => resolve(request.result);
			request.onerror = () => {
				this.logger.error("Failed to get watchtime by platform:", request.error);
				reject(request.error);
			};
		});
	}
}
