import type { Logger } from "$shared/logger/logger.ts";
import type { SharedDatabase } from "$shared/worker/database/shared.database.ts";
import type { CrossPlatformFollowsRefresher } from "$shared/worker/cross-platform-follows/cross-platform-follows.refresher.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { ClearFollowsPayload } from "$types/shared/worker/cross-platform-follows-worker.types.ts";

export class ClearFollowsHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly database: SharedDatabase,
		private readonly refresher: CrossPlatformFollowsRefresher,
	) {
		super(logger);
	}

	async handle(payload: ClearFollowsPayload): Promise<{ success: true }> {
		if (!payload || !["kick", "twitch"].includes(payload.platform)) {
			throw new Error("Invalid payload for clearFollows action. 'platform' is required.");
		}

		const removed = await this.database.clear(payload.platform);
		if (removed) {
			this.logger.debug(`Cleared ${payload.platform} follows`);
			await this.refresher.broadcast(payload.platform);
		}
		return { success: true };
	}
}
