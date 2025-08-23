import { Logger } from "$shared/logger/logger.ts";
import { DEFAULT_COMMON_DATABASE } from "$shared/worker/common/common-database.constants.ts";
import type { CommonDatabaseData } from "$types/shared/storage/common-database.types.ts";

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

		if (!db.objectStoreNames.contains(this.storeName)) {
			db.createObjectStore(this.storeName, { keyPath: "id" });
		}
	}

	async getData(): Promise<CommonDatabaseData> {
		if (!this.database) {
			throw new Error("Database not initialized");
		}

		return new Promise((resolve, reject) => {
			// biome-ignore lint/style/noNonNullAssertion: checking it above
			const tx = this.database!.transaction(this.storeName, "readonly");
			const store = tx.objectStore(this.storeName);
			const request = store.get("common");

			request.onsuccess = () => {
				const result = request.result as CommonDatabaseData | undefined;
				const defaultData = DEFAULT_COMMON_DATABASE;
				const data = result ? { ...defaultData, ...result } : defaultData;
				resolve(data);
			};

			request.onerror = () => {
				this.logger.error("Failed to get common database:", request.error);
				reject(request.error);
			};
		});
	}

	async setData(data: CommonDatabaseData): Promise<void> {
		if (!this.database) {
			throw new Error("Database not initialized");
		}

		return new Promise((resolve, reject) => {
			// biome-ignore lint/style/noNonNullAssertion: checking it above
			const tx = this.database!.transaction(this.storeName, "readwrite");
			const store = tx.objectStore(this.storeName);
			const request = store.put({ ...data, id: "common" });

			request.onsuccess = () => resolve();
			request.onerror = () => {
				this.logger.error("Failed to set common database:", request.error);
				reject(request.error);
			};
		});
	}
}
