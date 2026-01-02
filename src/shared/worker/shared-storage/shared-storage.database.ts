import { Logger } from "$shared/logger/logger.ts";
import { DEFAULT_SHARED_STORAGE } from "$shared/worker/shared-storage/shared-storage.constants.ts";
import type { SharedStorageData } from "$types/shared/storage/shared-storage.types.ts";

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

			request.onupgradeneeded = (event) => {
				this.handleUpgrade(event);
			};
		});
	}

	private handleUpgrade(event: IDBVersionChangeEvent): void {
		const db = (event.target as IDBOpenDBRequest).result;
		this.logger.info(`Creating shared storage database (version ${this.dbVersion})...`);

		if (!db.objectStoreNames.contains(this.storeName)) {
			db.createObjectStore(this.storeName, { keyPath: "id" });
		}
	}

	async getData(): Promise<SharedStorageData> {
		if (!this.database) {
			throw new Error("Database not initialized");
		}

		return new Promise((resolve, reject) => {
			// biome-ignore lint/style/noNonNullAssertion: checking it above
			const tx = this.database!.transaction(this.storeName, "readonly");
			const store = tx.objectStore(this.storeName);
			const request = store.get("shared_storage");

			request.onsuccess = () => {
				const result = request.result as SharedStorageData | undefined;
				const defaultData = DEFAULT_SHARED_STORAGE;
				const data = result ? { ...defaultData, ...result } : defaultData;
				resolve(data);
			};

			request.onerror = () => {
				this.logger.error("Failed to get shared storage data:", request.error);
				reject(request.error);
			};
		});
	}

	async setData(data: SharedStorageData): Promise<void> {
		if (!this.database) {
			throw new Error("Database not initialized");
		}

		return new Promise((resolve, reject) => {
			// biome-ignore lint/style/noNonNullAssertion: checking it above
			const tx = this.database!.transaction(this.storeName, "readwrite");
			const store = tx.objectStore(this.storeName);
			const request = store.put({ ...data, id: "shared_storage" });

			request.onsuccess = () => resolve();
			request.onerror = () => {
				this.logger.error("Failed to set shared storage data:", request.error);
				reject(request.error);
			};
		});
	}
}
