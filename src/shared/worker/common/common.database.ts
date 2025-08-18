import { Logger } from "$shared/logger/logger.ts";
import type { CommonRecord } from "$types/shared/common/common.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";

export class CommonDatabase {
	private readonly logger = new Logger({ context: "common-db" });
	private database: IDBDatabase | null = null;
	private readonly dbName = "enhancer_common";
	private readonly dbVersion = 1;
	private readonly storeName = "common";

	async initialize(): Promise<void> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, this.dbVersion);

			request.onerror = () => {
				this.logger.error("Failed to open common database:", request.error);
				reject(request.error);
			};

			request.onsuccess = () => {
				this.database = request.result;
				this.logger.info("Common database loaded successfully");
				resolve();
			};

			request.onupgradeneeded = (event) => {
				this.handleUpgrade(event);
			};
		});
	}

	private handleUpgrade(event: IDBVersionChangeEvent): void {
		const db = (event.target as IDBOpenDBRequest).result;
		this.logger.info(`Creating common database (version ${this.dbVersion})...`);
		const store = db.createObjectStore(this.storeName, { keyPath: "id" });
		store.createIndex("by_platform", "platform");
		store.createIndex("by_key", "key");
		store.createIndex("by_platform_key", ["platform", "key"], { unique: true });
	}

	private createId(platform: PlatformType, key: string): string {
		return `${platform}:${key}`;
	}

	async getValue<T>(platform: PlatformType, key: string): Promise<T | null> {
		if (!this.database) {
			throw new Error("Database not initialized");
		}
		const id = this.createId(platform, key);
		return new Promise((resolve, reject) => {
			// biome-ignore lint/style/noNonNullAssertion: checked above
			const tx = this.database!.transaction(this.storeName, "readonly");
			const store = tx.objectStore(this.storeName);
			const request = store.get(id);

			request.onsuccess = () => {
				const record = request.result as CommonRecord | undefined;
				resolve((record?.value as T) ?? null);
			};
			request.onerror = () => {
				this.logger.error("Failed to get common value:", request.error);
				reject(request.error);
			};
		});
	}

	async setValue(platform: PlatformType, key: string, value: unknown): Promise<void> {
		if (!this.database) {
			throw new Error("Database not initialized");
		}
		const now = Date.now();
		const record: CommonRecord = {
			id: this.createId(platform, key),
			platform,
			key,
			value,
			lastUpdate: now,
		};

		return new Promise((resolve, reject) => {
			// biome-ignore lint/style/noNonNullAssertion: checked above
			const tx = this.database!.transaction(this.storeName, "readwrite");
			const store = tx.objectStore(this.storeName);
			const request = store.put(record);

			request.onsuccess = () => resolve();
			request.onerror = () => {
				this.logger.error("Failed to set common value:", request.error);
				reject(request.error);
			};
		});
	}
}
