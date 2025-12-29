import type { Logger } from "$shared/logger/logger.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { WatchtimeService } from "$shared/worker/watchtime/watchtime.service.ts";
import type { ImportWatchtimePayload, PlatformType, WatchtimeResponse } from "$types/shared/worker/worker.types.ts";

export class ImportWatchtimeHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly watchtimeService: WatchtimeService,
	) {
		super(logger);
	}

	async handle(payload: ImportWatchtimePayload): Promise<WatchtimeResponse | null> {
		if (!payload || !payload.username || !payload.platform || payload.time === undefined) {
			throw new Error("Invalid payload for importWatchtime action. 'platform', 'username', and 'time' are required.");
		}
		if (!["kick", "twitch"].includes(payload.platform)) {
			throw new Error("Invalid platform. Must be 'kick' or 'twitch'.");
		}
		if (payload.time < 0) {
			throw new Error("Time must be a non-negative number.");
		}

		this.logger.debug(
			`Importing watchtime for ${payload.platform} channel: ${payload.username}, time: ${payload.time}`,
		);
		return await this.watchtimeService.importWatchtime(
			payload.platform,
			payload.username,
			payload.time,
			payload.firstUpdate,
			payload.lastUpdate,
		);
	}
}
