import { Logger } from "$shared/logger/logger.ts";
import { SharedStorageDatabase } from "$shared/worker/shared-storage/shared-storage.database.ts";
import type { SharedStorageData } from "$types/shared/storage/shared-storage.types.ts";

export class SharedStorageService {
	private readonly logger = new Logger({ context: "shared-storage-service" });
	private readonly database = new SharedStorageDatabase();

	async initialize(): Promise<void> {
		await this.database.initialize();
		this.logger.info("Shared storage service initialized");
	}

	async getData() {
		return await this.database.getData();
	}

	async setData(data: SharedStorageData): Promise<void> {
		await this.database.setData(data);
		this.logger.debug("Updated shared storage data", data);
	}
}
