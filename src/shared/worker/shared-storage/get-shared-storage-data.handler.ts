import type { Logger } from "$shared/logger/logger.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { SharedStorageService } from "$shared/worker/shared-storage/shared-storage.service.ts";
import type { SharedStorageData } from "$types/shared/storage/shared-storage.types.ts";

export interface GetSharedStorageDataResponse {
	data: SharedStorageData;
}

export class GetSharedStorageDataHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly sharedStorageService: SharedStorageService,
	) {
		super(logger);
	}

	async handle(): Promise<GetSharedStorageDataResponse> {
		const data = await this.sharedStorageService.getData();
		return { data };
	}
}
