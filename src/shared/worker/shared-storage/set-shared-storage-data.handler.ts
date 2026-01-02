import type { Logger } from "$shared/logger/logger.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { SharedStorageService } from "$shared/worker/shared-storage/shared-storage.service.ts";
import type { SharedStorageData } from "$types/shared/storage/shared-storage.types.ts";

export interface SetSharedStorageDataPayload {
	data: SharedStorageData;
}

export interface SetSharedStorageDataResponse {
	success: true;
}

export class SetSharedStorageDataHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly sharedStorageService: SharedStorageService,
	) {
		super(logger);
	}

	async handle(payload: SetSharedStorageDataPayload): Promise<SetSharedStorageDataResponse> {
		await this.sharedStorageService.setData(payload.data);
		return { success: true };
	}
}
