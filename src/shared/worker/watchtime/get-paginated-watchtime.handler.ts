import type { Logger } from "$shared/logger/logger.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { WatchtimeService } from "$shared/worker/watchtime/watchtime.service.ts";
import type { GetPaginatedWatchtimePayload, PaginatedWatchtimeResponse } from "$types/shared/worker/worker.types.ts";

export class GetPaginatedWatchtimeHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly watchtimeService: WatchtimeService,
	) {
		super(logger);
	}

	async handle(payload: GetPaginatedWatchtimePayload): Promise<PaginatedWatchtimeResponse> {
		if (!payload || !payload.platform || payload.page === undefined || !payload.pageSize) {
			throw new Error(
				"Invalid payload for getPaginatedWatchtime action. 'platform', 'page', and 'pageSize' are required.",
			);
		}

		this.logger.debug(
			`Getting paginated watchtime for platform=${payload.platform}, page=${payload.page}, pageSize=${payload.pageSize}`,
		);

		const data = await this.watchtimeService.getAllWatchtimePaginated(payload.platform, payload.page, payload.pageSize);

		return {
			data,
			page: payload.page,
			pageSize: payload.pageSize,
			total: data.length,
		};
	}
}
