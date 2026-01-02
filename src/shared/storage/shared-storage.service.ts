import type WorkerService from "$shared/worker/worker.service.ts";
import type { SharedStorageData } from "$types/shared/storage/shared-storage.types.ts";

export default class SharedStorageService {
	constructor(private readonly workerService: WorkerService) {}

	async getSharedStorage(): Promise<SharedStorageData> {
		const result = await this.workerService.send("getSharedStorageData", {});
		if (!result?.data) throw new Error("Could not find shared storage");
		return result.data;
	}

	async getSharedStorageKey<K extends keyof SharedStorageData>(key: K): Promise<SharedStorageData[K]> {
		const storage = await this.getSharedStorage();
		return storage[key];
	}

	async updateSharedStorageKey<K extends keyof SharedStorageData>(key: K, value: SharedStorageData[K]) {
		const storage = await this.getSharedStorage();
		await this.updateSharedStorage({ ...storage, [key]: value });
	}

	async updateSharedStorage(storage: SharedStorageData) {
		const result = await this.workerService.send("setSharedStorageData", { data: storage });
		if (!result) return false;
		return result.success;
	}
}
