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
		if (!payload || !payload.platform || !(isRecord(payload.settings) || isRecord(payload.changes))) {
			throw new Error("Invalid payload for updateSettings action. 'platform' and 'settings' are required.");
		}

		if (!["kick", "twitch"].includes(payload.platform)) {
			throw new Error("Invalid platform. Must be 'kick' or 'twitch'.");
		}

		this.logger.debug(`Updating settings for platform: ${payload.platform}`);
		const settings = payload.settings
			? await this.database.updateSettings(payload.platform, payload.settings)
			: await this.database.patchSettings(payload.platform, payload.changes);

		const broadcast: WorkerBroadcast = {
			type: "settings-updated",
			payload: { platform: payload.platform, settings },
		};
		const tabs = await chrome.tabs.query({});
		for (const tab of tabs) {
			if (tab.id) {
				chrome.tabs.sendMessage(tab.id, broadcast).catch(() => {});
			}
		}

		return { success: true, settings };
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
