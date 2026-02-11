import type { Logger } from "$shared/logger/logger.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { SharedStorageService } from "$shared/worker/shared-storage/shared-storage.service.ts";
import type { GetLiveStreamersCacheResponse } from "$types/shared/worker/shared-storage.types.ts";

export class GetLiveStreamersCacheHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly sharedStorageService: SharedStorageService,
	) {
		super(logger);
	}

	async handle(): Promise<GetLiveStreamersCacheResponse> {
		this.logger.debug("Getting live streamers cache");
		const streamers = this.sharedStorageService.getLiveStreamersCache();
		return { streamers };
	}
}
