import { Logger } from "$shared/logger/logger.ts";
import { SharedStorageDatabase } from "$shared/worker/shared-storage/shared-storage.database.ts";
import type { SharedStorageData } from "$types/shared/storage/shared-storage.types.ts";

type StorageChangeCallback = (data: SharedStorageData) => void | Promise<void>;

export class SharedStorageService {
	private readonly logger = new Logger({ context: "shared-storage-service" });
	private readonly database = new SharedStorageDatabase();
	private readonly changeCallbacks: StorageChangeCallback[] = [];

	async initialize(): Promise<void> {
		await this.database.initialize();
		this.logger.info("Shared storage service initialized");
	}

	async getData(): Promise<SharedStorageData> {
		return await this.database.getData();
	}

	async setData(data: SharedStorageData): Promise<void> {
		await this.database.setData(data);
		this.logger.debug("Updated shared storage data", data);

		// Notify all registered callbacks
		for (const callback of this.changeCallbacks) {
			try {
				await callback(data);
			} catch (error) {
				this.logger.error("Error in storage change callback:", error);
			}
		}
	}

	/**
	 * Register a callback to be called when storage data changes
	 */
	onStorageChange(callback: StorageChangeCallback): () => void {
		this.changeCallbacks.push(callback);

		// Return unsubscribe function
		return () => {
			const index = this.changeCallbacks.indexOf(callback);
			if (index > -1) {
				this.changeCallbacks.splice(index, 1);
			}
		};
	}
}
