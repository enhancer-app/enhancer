import type { Logger } from "$shared/logger/logger.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { WatchtimeDatabase } from "$shared/worker/watchtime/watchtime.database.ts";
import type {
	ImportWatchtimePayload,
	PlatformType,
	WatchtimeRecord,
	WatchtimeResponse,
} from "$types/shared/worker/worker.types.ts";

export class ImportWatchtimeHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly database: WatchtimeDatabase,
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

		const now = Date.now();
		const normalizedUsername = payload.username.toLowerCase();
		const id = this.createId(payload.platform, normalizedUsername);

		const watchtimeRecord: WatchtimeRecord = {
			id,
			platform: payload.platform as PlatformType,
			username: normalizedUsername,
			time: payload.time,
			firstUpdate: payload.firstUpdate ?? now,
			lastUpdate: payload.lastUpdate ?? now,
		};

		await this.database.setWatchtime(watchtimeRecord);
		return watchtimeRecord;
	}

	private createId(platform: PlatformType, username: string): string {
		return `${platform}:${username.toLowerCase()}`;
	}
}
