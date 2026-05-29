import type { Logger } from "$shared/logger/logger.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { SettingsDatabase } from "$shared/worker/settings/settings.database.ts";
import type { GetSettingsPayload, GetSettingsResponse } from "$types/shared/worker/worker.types.ts";

export class GetSettingsHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly database: SettingsDatabase,
	) {
		super(logger);
	}

	async handle(payload: GetSettingsPayload): Promise<GetSettingsResponse> {
		if (!payload || !payload.platform) {
			throw new Error("Invalid payload for getSettings action. 'platform' is required.");
		}

		if (!["kick", "twitch"].includes(payload.platform)) {
			throw new Error("Invalid platform. Must be 'kick' or 'twitch'.");
		}

		this.logger.debug(`Getting settings for platform: ${payload.platform}`);
		return await this.database.getSettings(payload.platform);
	}
}
