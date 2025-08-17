import type { Logger } from "$shared/logger/logger.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { CommonService } from "$shared/worker/common/common.service.ts";
import type { GetCommonPayload, GetCommonResponse } from "$types/shared/worker/worker.types.ts";

export class GetCommonHandler extends MessageHandler {
  constructor(
    logger: Logger,
    private readonly commonService: CommonService,
  ) {
    super(logger);
  }

  async handle(payload: GetCommonPayload): Promise<GetCommonResponse> {
    if (!payload || !payload.platform || !payload.key) {
      throw new Error("Invalid payload for getCommon action. 'platform' and 'key' are required.");
    }
    this.logger.debug(`Getting common value for ${payload.platform}:${payload.key}`);
    const value = await this.commonService.getValue(payload.platform, payload.key);
    return { value };
  }
}


