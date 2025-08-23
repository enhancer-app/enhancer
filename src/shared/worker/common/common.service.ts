import { Logger } from "$shared/logger/logger.ts";
import { CommonDatabase } from "$shared/worker/common/common.database.ts";
import type { CommonDatabaseData } from "$types/shared/storage/common-database.types.ts";

export class CommonService {
	private readonly logger = new Logger({ context: "common-service" });
	private readonly database = new CommonDatabase();

	async initialize(): Promise<void> {
		await this.database.initialize();
		this.logger.info("Common service initialized");
	}

	async getData() {
		return await this.database.getData();
	}

	async setData(data: CommonDatabaseData): Promise<void> {
		await this.database.setData(data);
		this.logger.debug("Updated common data", data);
	}
}
