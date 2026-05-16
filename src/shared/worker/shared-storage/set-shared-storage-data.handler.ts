import type { Logger } from "$shared/logger/logger.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { SharedStorageService } from "$shared/worker/shared-storage/shared-storage.service.ts";
import type { SetSharedStorageDataPayload, SetSharedStorageDataResponse } from "$types/shared/worker/worker.types.ts";

export class SetSharedStorageDataHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly sharedStorageService: SharedStorageService,
	) {
		super(logger);
	}

	async handle(payload: SetSharedStorageDataPayload): Promise<SetSharedStorageDataResponse> {
		if (!payload || !payload.data) {
			throw new Error("Invalid payload for setSharedStorageData action. 'data' is required.");
		}
		this.logger.debug("Setting shared storage data");
		await this.sharedStorageService.setData(payload.data);
		return { success: true };
	}
}
