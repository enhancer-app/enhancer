import { Logger } from "$shared/logger/logger.ts";

export class SharedStorageDatabase {
	private readonly logger = new Logger({ context: "shared-storage-db" });
	private database: IDBDatabase | null = null;
	private readonly dbName = "enhancer_shared_storage";
	private readonly dbVersion = 1;
	private readonly storeName = "shared_storage";

	async initialize(): Promise<void> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, this.dbVersion);

			request.onerror = () => {
				this.logger.error("Failed to open shared storage database:", request.error);
				reject(request.error);
			};

			request.onsuccess = () => {
				this.database = request.result;
				this.logger.info("Shared storage database loaded successfully");
				resolve();
			};

			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains(this.storeName)) {
					db.createObjectStore(this.storeName, { keyPath: "id" });
				}
			};
		});
	}

	async get(key: string): Promise<unknown | null> {
		if (!this.database) {
			throw new Error("Database not initialized");
		}
		return new Promise((resolve, reject) => {
			// biome-ignore lint/style/noNonNullAssertion: checking it above
			const tx = this.database!.transaction(this.storeName, "readonly");
			const store = tx.objectStore(this.storeName);
			const request = store.get(key);

			request.onsuccess = () => {
				const result = request.result as { id: string; value: unknown; lastUpdate: number } | undefined;
				resolve(result?.value ?? null);
			};
			request.onerror = () => {
				this.logger.error("Failed to get shared storage value:", request.error);
				reject(request.error);
			};
		});
	}

	async set(key: string, value: unknown): Promise<void> {
		if (!this.database) {
			throw new Error("Database not initialized");
		}
		const record = {
			id: key,
			value,
			lastUpdate: Date.now(),
		};
		return new Promise((resolve, reject) => {
			// biome-ignore lint/style/noNonNullAssertion: checking it above
			const tx = this.database!.transaction(this.storeName, "readwrite");
			const store = tx.objectStore(this.storeName);
			const request = store.put(record);

			request.onsuccess = () => resolve();
			request.onerror = () => {
				this.logger.error("Failed to set shared storage value:", request.error);
				reject(request.error);
			};
		});
	}
}
