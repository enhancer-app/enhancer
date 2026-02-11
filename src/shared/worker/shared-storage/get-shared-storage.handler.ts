import type { Logger } from "$shared/logger/logger.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { SharedStorageService } from "$shared/worker/shared-storage/shared-storage.service.ts";
import type { GetSharedStoragePayload, GetSharedStorageResponse } from "$types/shared/worker/shared-storage.types.ts";

export class GetSharedStorageHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly sharedStorageService: SharedStorageService,
	) {
		super(logger);
	}

	async handle(payload: GetSharedStoragePayload): Promise<GetSharedStorageResponse> {
		if (!payload?.key) {
			throw new Error("Invalid payload for getSharedStorage action. 'key' is required.");
		}
		this.logger.debug(`Getting shared storage value for key: ${payload.key}`);
		const value = await this.sharedStorageService.get(payload.key);
		return { value };
	}
}
