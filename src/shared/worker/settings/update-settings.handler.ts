import type { Logger } from "$shared/logger/logger.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { SettingsDatabase } from "$shared/worker/settings/settings.database.ts";
import type {
	UpdateSettingsPayload,
	UpdateSettingsResponse,
	WorkerBroadcast,
} from "$types/shared/worker/worker.types.ts";

export class UpdateSettingsHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly database: SettingsDatabase,
	) {
		super(logger);
	}

	async handle(payload: UpdateSettingsPayload): Promise<UpdateSettingsResponse> {
		if (!payload || !payload.platform || !payload.settings) {
			throw new Error("Invalid payload for updateSettings action. 'platform' and 'settings' are required.");
		}

		if (!["kick", "twitch"].includes(payload.platform)) {
			throw new Error("Invalid platform. Must be 'kick' or 'twitch'.");
		}

		this.logger.debug(`Updating settings for platform: ${payload.platform}`);
		await this.database.updateSettings(payload.platform, payload.settings);

		const broadcast: WorkerBroadcast = {
			type: "settings-updated",
			payload: { platform: payload.platform, settings: payload.settings },
		};
		const tabs = await chrome.tabs.query({});
		for (const tab of tabs) {
			if (tab.id) {
				chrome.tabs.sendMessage(tab.id, broadcast).catch(() => {});
			}
		}

		return { success: true };
	}
}
