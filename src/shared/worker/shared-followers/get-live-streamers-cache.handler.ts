import type { Logger } from "$shared/logger/logger.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { SharedFollowersService } from "$shared/worker/shared-followers/shared-followers.service.ts";
import type { GetLiveStreamersCacheResponse } from "$types/shared/worker/shared-storage.types.ts";

export class GetLiveStreamersCacheHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly sharedFollowersService: SharedFollowersService,
	) {
		super(logger);
	}

	async handle(): Promise<GetLiveStreamersCacheResponse> {
		this.logger.debug("Getting live streamers cache");
		const streamers = this.sharedFollowersService.getLiveStreamersCache();
		return { streamers };
	}
}
