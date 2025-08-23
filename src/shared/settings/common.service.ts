import type WorkerService from "$shared/worker/worker.service.ts";
import type { CommonDatabaseData } from "$types/shared/storage/common-database.types.ts";

export default class CommonDataService {
	constructor(private readonly workerService: WorkerService) {}

	async getData(): Promise<CommonDatabaseData> {
		const common = await this.workerService.send("getCommonData", {});
		if (!common?.data) throw new Error("Could not find common storage");
		return common.data;
	}

	async getCommonKey<K extends keyof CommonDatabaseData>(key: K): Promise<CommonDatabaseData[K]> {
		const common = await this.getData();
		return common[key];
	}

	async updateCommonKey<K extends keyof CommonDatabaseData>(key: K, value: CommonDatabaseData[K]): Promise<boolean> {
		const common = await this.getData();
		const updated: CommonDatabaseData = { ...common, [key]: value };
		return this.updateData(updated);
	}

	async updateCommonNestedKey<K1 extends keyof CommonDatabaseData, K2 extends keyof CommonDatabaseData[K1]>(
		key1: K1,
		key2: K2,
		value: CommonDatabaseData[K1][K2],
	): Promise<boolean> {
		const common = await this.getData();
		const updated: CommonDatabaseData = {
			...common,
			[key1]: {
				...common[key1],
				[key2]: value,
			},
		};
		return this.updateData(updated);
	}

	async updateData(data: CommonDatabaseData): Promise<boolean> {
		const result = await this.workerService.send("setCommonData", { data });
		if (!result) return false;
		return result.success;
	}
}
