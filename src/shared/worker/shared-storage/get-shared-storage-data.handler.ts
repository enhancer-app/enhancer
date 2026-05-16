import type { Logger } from "$shared/logger/logger.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { SharedStorageService } from "$shared/worker/shared-storage/shared-storage.service.ts";
import type { GetSharedStorageDataPayload, GetSharedStorageDataResponse } from "$types/shared/worker/worker.types.ts";

export class GetSharedStorageDataHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly sharedStorageService: SharedStorageService,
	) {
		super(logger);
	}

	async handle(_payload: GetSharedStorageDataPayload): Promise<GetSharedStorageDataResponse> {
		const data = await this.sharedStorageService.getData();
		return { data };
	}
}
