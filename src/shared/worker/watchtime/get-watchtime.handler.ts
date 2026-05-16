import type { Logger } from "$shared/logger/logger.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { WatchtimeDatabase } from "$shared/worker/watchtime/watchtime.database.ts";
import type { GetWatchtimePayload, WatchtimeResponse } from "$types/shared/worker/worker.types.ts";

export class GetWatchtimeHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly database: WatchtimeDatabase,
	) {
		super(logger);
	}

	async handle(payload: GetWatchtimePayload): Promise<WatchtimeResponse | null> {
		if (!payload || !payload.channel || !payload.platform) {
			throw new Error("Invalid payload for getWatchtime action. 'platform' and 'channel' are required.");
		}
		if (!["kick", "twitch"].includes(payload.platform)) {
			throw new Error("Invalid platform. Must be 'kick' or 'twitch'.");
		}
		this.logger.debug(`Getting watchtime for ${payload.platform} channel: ${payload.channel}`);
		return await this.database.getWatchtime(payload.platform, payload.channel);
	}
}
