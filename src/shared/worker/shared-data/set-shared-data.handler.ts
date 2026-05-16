import type { Logger } from "$shared/logger/logger.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { SharedDataDatabase } from "$shared/worker/shared-data/shared-data.database.ts";
import type { SetSharedDataPayload, SetSharedDataResponse } from "$types/shared/worker/worker.types.ts";

export class SetSharedDataHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly database: SharedDataDatabase,
	) {
		super(logger);
	}

	async handle(payload: SetSharedDataPayload): Promise<SetSharedDataResponse> {
		if (!payload?.data) {
			throw new Error("Invalid payload for setSharedData action. 'data' is required.");
		}
		this.logger.debug("Setting shared data");
		await this.database.setData(payload.data);
		return { success: true };
	}
}
