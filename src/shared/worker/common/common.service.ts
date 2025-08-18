import { Logger } from "$shared/logger/logger.ts";
import { CommonDatabase } from "$shared/worker/common/common.database.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";

export class CommonService {
	private readonly logger = new Logger({ context: "common-service" });
	private readonly database = new CommonDatabase();

	async initialize(): Promise<void> {
		await this.database.initialize();
		this.logger.info("Common service initialized");
	}

	async getValue<T>(platform: PlatformType, key: string): Promise<T | null> {
		return await this.database.getValue<T>(platform, key);
	}

	async setValue(platform: PlatformType, key: string, value: unknown): Promise<void> {
		await this.database.setValue(platform, key, value);
		this.logger.debug(`Updated common value ${platform}:${key}`);
	}
}
