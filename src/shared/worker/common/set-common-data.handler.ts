import type { Logger } from "$shared/logger/logger.ts";
import type { CommonService } from "$shared/worker/common/common.service.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { SetCommonDataPayload, SetCommonDataResponse } from "$types/shared/worker/worker.types.ts";

export class SetCommonDataHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly commonService: CommonService,
	) {
		super(logger);
	}

	async handle(payload: SetCommonDataPayload): Promise<SetCommonDataResponse> {
		if (!payload || !payload.data) {
			throw new Error("Invalid payload for setCommonData action. 'data' is required.");
		}
		this.logger.debug("Setting common data");
		await this.commonService.setData(payload.data);
		return { success: true };
	}
}
