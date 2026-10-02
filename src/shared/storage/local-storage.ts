import { Logger } from "$shared/logger/logger.ts";
import Storage from "$shared/storage/storage.ts";

export default class LocalStorage<T extends Record<string, any>> extends Storage<T> {
	private readonly logger = new Logger({ context: "local-storage" });
	private cache: Partial<T> | undefined;

	async save<K extends keyof T>(key: K, value: T[K]): Promise<void> {
		const storage = this.getMutableStorage();
		storage[key] = value;
		this.updateCacheAndPersist(storage);
	}

	async get<K extends keyof T>(key: K): Promise<T[K] | undefined> {
		const storage = this.getImmutableStorage();

		return storage[key];
	}

	async getOrDefault<K extends keyof T>(key: K, defaultValue: T[K]): Promise<T[K]> {
		const existingValue = await this.get(key);

		if (existingValue !== undefined) {
			return existingValue;
		}

		await this.save(key, defaultValue);

		return defaultValue;
	}

	private getMutableStorage(): Partial<T> {
		return this.parseStorage(JSON.stringify(this.getImmutableStorage()));
	}

	private getImmutableStorage(): Partial<T> {
		if (this.cache) {
			return this.cache;
		}

		const rawStorage = localStorage.getItem(this.storageId);

		if (rawStorage) {
			try {
				this.cache = this.parseStorage(rawStorage);

				return this.cache;
			} catch (error) {
				this.logger.error("Failed to parse storage data:", error);
			}
		}

		this.cache = {};

		return this.cache;
	}

	private parseStorage(rawStorage: string): Partial<T> {
		// SAFETY: this storage key is only written by updateCacheAndPersist, which serializes a Partial<T>.
		return JSON.parse(rawStorage) as Partial<T>;
	}

	private updateCacheAndPersist(storage: Partial<T>): void {
		this.cache = storage;
		localStorage.setItem(this.storageId, JSON.stringify(storage));
	}
}
