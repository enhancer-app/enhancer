import type { Logger } from "$shared/logger/logger.ts";
import type { CommonService } from "$shared/worker/common/common.service.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { SetCommonPayload, SetCommonResponse } from "$types/shared/worker/worker.types.ts";

export class SetCommonHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly commonService: CommonService,
	) {
		super(logger);
	}

	async handle(payload: SetCommonPayload): Promise<SetCommonResponse> {
		if (!payload || !payload.platform || !payload.key) {
			throw new Error("Invalid payload for setCommon action. 'platform' and 'key' are required.");
		}
		this.logger.debug(`Setting common value for ${payload.platform}:${payload.key}`);
		await this.commonService.setValue(payload.platform, payload.key, payload.value);
		return { success: true };
	}
}
