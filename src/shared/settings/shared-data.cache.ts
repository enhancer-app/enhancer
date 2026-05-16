import type WorkerService from "$shared/worker/worker.service.ts";
import type { SharedData } from "$types/shared/storage/shared-data.types.ts";

export default class SharedDataCache {
	private cache: SharedData | null = null;

	constructor(private readonly workerService: WorkerService) {}

	async initialize(): Promise<void> {
		const response = await this.workerService.send("getSharedData", {});
		if (response?.data) {
			this.cache = response.data;
		}
	}

	get(): SharedData {
		if (!this.cache) throw new Error("Shared data not initialized");
		return this.cache;
	}

	async update(data: SharedData): Promise<void> {
		await this.workerService.send("setSharedData", { data });
		this.cache = data;
	}

	async updateKey<K extends keyof SharedData>(key: K, value: SharedData[K]): Promise<void> {
		await this.update({ ...this.get(), [key]: value });
	}

	async updateNestedKey<K1 extends keyof SharedData, K2 extends keyof SharedData[K1]>(
		key1: K1,
		key2: K2,
		value: SharedData[K1][K2],
	): Promise<void> {
		const current = this.get();
		await this.update({
			...current,
			[key1]: {
				...current[key1],
				[key2]: value,
			},
		});
	}
}
