import { Logger } from "$shared/logger/logger.ts";
import { SharedStorageDatabase } from "$shared/worker/shared-storage/shared-storage.database.ts";
import type { SharedStorageKey, SharedStorageKeys } from "$types/shared/worker/shared-storage.types.ts";

export class SharedStorageService {
	private readonly logger = new Logger({ context: "shared-storage-service" });
	private readonly database = new SharedStorageDatabase();

	async initialize(): Promise<void> {
		await this.database.initialize();
		this.logger.info("Shared storage service initialized");
	}

	async get<K extends SharedStorageKey>(key: K): Promise<SharedStorageKeys[K] | null> {
		const value = await this.database.get(key);
		return value as SharedStorageKeys[K] | null;
	}

	async set<K extends SharedStorageKey>(key: K, value: SharedStorageKeys[K]): Promise<void> {
		await this.database.set(key, value);
		this.logger.debug(`Shared storage updated for key: ${key}`);
	}
}
