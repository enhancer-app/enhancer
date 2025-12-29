import type WorkerService from "$shared/worker/worker.service.ts";
import type { SharedStorageData } from "$types/shared/storage/shared-storage.types.ts";

export default class SharedStorageDataService {
	constructor(private readonly workerService: WorkerService) {}

	async getData(): Promise<SharedStorageData> {
		const storage = await this.workerService.send("getSharedStorageData", {});
		if (!storage) throw new Error("Failed to retrieve shared storage data");
		if (!storage.data) throw new Error("Could not find shared storage");
		return storage.data;
	}

	async getStorageKey<K extends keyof SharedStorageData>(key: K): Promise<SharedStorageData[K]> {
		const storage = await this.getData();
		return storage[key];
	}

	async updateStorageKey<K extends keyof SharedStorageData>(key: K, value: SharedStorageData[K]): Promise<boolean> {
		const storage = await this.getData();
		const updated: SharedStorageData = { ...storage, [key]: value };
		return this.updateData(updated);
	}

	async updateStorageNestedKey<K1 extends keyof SharedStorageData, K2 extends keyof SharedStorageData[K1]>(
		key1: K1,
		key2: K2,
		value: SharedStorageData[K1][K2],
	): Promise<boolean> {
		const storage = await this.getData();
		const updated: SharedStorageData = {
			...storage,
			[key1]: {
				...storage[key1],
				[key2]: value,
			},
		};
		return this.updateData(updated);
	}

	async updateData(data: SharedStorageData): Promise<boolean> {
		const result = await this.workerService.send("setSharedStorageData", { data });
		if (!result) return false;
		return result.success;
	}
}
