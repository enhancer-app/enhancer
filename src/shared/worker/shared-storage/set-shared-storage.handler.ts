import type { Logger } from "$shared/logger/logger.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { SharedStorageService } from "$shared/worker/shared-storage/shared-storage.service.ts";
import type { SetSharedStoragePayload, SetSharedStorageResponse } from "$types/shared/worker/shared-storage.types.ts";

export class SetSharedStorageHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly sharedStorageService: SharedStorageService,
	) {
		super(logger);
	}

	async handle(payload: SetSharedStoragePayload): Promise<SetSharedStorageResponse> {
		if (!payload?.key) {
			throw new Error("Invalid payload for setSharedStorage action. 'key' is required.");
		}
		if (payload.value === undefined) {
			throw new Error("Invalid payload for setSharedStorage action. 'value' is required.");
		}
		this.logger.debug(`Setting shared storage value for key: ${payload.key}`);
		await this.sharedStorageService.set(payload.key, payload.value);
		return { success: true };
	}
}
