import type { Logger } from "$shared/logger/logger.ts";
import type { CommonService } from "$shared/worker/common/common.service.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { GetCommonDataPayload, GetCommonDataResponse } from "$types/shared/worker/worker.types.ts";

export class GetCommonDataHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly commonService: CommonService,
	) {
		super(logger);
	}

	async handle(payload: GetCommonDataPayload): Promise<GetCommonDataResponse> {
		const data = await this.commonService.getData();
		return { data };
	}
}
