import type { Logger } from "$shared/logger/logger.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { SharedDataDatabase } from "$shared/worker/shared-data/shared-data.database.ts";
import type { GetSharedDataResponse } from "$types/shared/worker/worker.types.ts";

export class GetSharedDataHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly database: SharedDataDatabase,
	) {
		super(logger);
	}

	async handle(): Promise<GetSharedDataResponse> {
		const data = await this.database.getData();
		return { data };
	}
}
