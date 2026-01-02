import { Logger } from "$shared/logger/logger.ts";
import { DEFAULT_CHAT_MONITOR_STORAGE } from "$shared/worker/chat-monitor-storage/chat-monitor-storage.constants.ts";
import type { ChatMonitorStorageData } from "$types/shared/storage/chat-monitor-storage.types.ts";

export class ChatMonitorStorageDatabase {
	private readonly logger = new Logger({ context: "chat-monitor-storage-db" });
	private database: IDBDatabase | null = null;
	private readonly dbName = "enhancer_chat_monitor_storage";
	private readonly dbVersion = 1;
	private readonly storeName = "chat_monitor_storage";

	async initialize(): Promise<void> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, this.dbVersion);

			request.onerror = () => {
				this.logger.error("Failed to open chat monitor storage database:", request.error);
				reject(request.error);
			};

			request.onsuccess = () => {
				this.database = request.result;
				this.logger.info("Chat monitor storage database loaded successfully");
				resolve();
			};

			request.onupgradeneeded = (event) => {
				this.handleUpgrade(event);
			};
		});
	}

	private handleUpgrade(event: IDBVersionChangeEvent): void {
		const db = (event.target as IDBOpenDBRequest).result;
		this.logger.info(`Creating chat monitor storage database (version ${this.dbVersion})...`);

		if (!db.objectStoreNames.contains(this.storeName)) {
			db.createObjectStore(this.storeName, { keyPath: "id" });
		}
	}

	async getData(): Promise<ChatMonitorStorageData> {
		if (!this.database) {
			throw new Error("Database not initialized");
		}

		return new Promise((resolve, reject) => {
			// biome-ignore lint/style/noNonNullAssertion: checking it above
			const tx = this.database!.transaction(this.storeName, "readonly");
			const store = tx.objectStore(this.storeName);
			const request = store.get("chat_monitor_storage");

			request.onsuccess = () => {
				const result = request.result as ChatMonitorStorageData | undefined;
				const defaultData = DEFAULT_CHAT_MONITOR_STORAGE;
				const data = result ? { ...defaultData, ...result } : defaultData;
				resolve(data);
			};

			request.onerror = () => {
				this.logger.error("Failed to get chat monitor storage data:", request.error);
				reject(request.error);
			};
		});
	}

	async setData(data: ChatMonitorStorageData): Promise<void> {
		if (!this.database) {
			throw new Error("Database not initialized");
		}

		return new Promise((resolve, reject) => {
			// biome-ignore lint/style/noNonNullAssertion: checking it above
			const tx = this.database!.transaction(this.storeName, "readwrite");
			const store = tx.objectStore(this.storeName);
			const request = store.put({ ...data, id: "chat_monitor_storage" });

			request.onsuccess = () => resolve();
			request.onerror = () => {
				this.logger.error("Failed to set chat monitor storage data:", request.error);
				reject(request.error);
			};
		});
	}
}
