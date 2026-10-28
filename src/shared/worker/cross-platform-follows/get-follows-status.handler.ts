import type { Logger } from "$shared/logger/logger.ts";
import type { CrossPlatformFollowsRefresher } from "$shared/worker/cross-platform-follows/cross-platform-follows.refresher.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { SettingsDatabase } from "$shared/worker/settings/settings.database.ts";
import type {
	CrossPlatformFollowsSnapshot,
	GetFollowsStatusPayload,
} from "$types/shared/worker/cross-platform-follows-worker.types.ts";

export class GetFollowsStatusHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly settingsDatabase: SettingsDatabase,
		private readonly refresher: CrossPlatformFollowsRefresher,
	) {
		super(logger);
	}

	async handle(payload: GetFollowsStatusPayload): Promise<CrossPlatformFollowsSnapshot> {
		if (!payload || !["kick", "twitch"].includes(payload.platform)) {
			throw new Error("Invalid payload for getFollowsStatus action. 'platform' is required.");
		}

		const settings = await this.settingsDatabase.getGlobalSettings();
		if (settings.crossPlatformFollowsSyncEnabled !== true) {
			return {
				platform: payload.platform,
				synced: false,
				syncedAt: null,
				checkedAt: null,
				problem: null,
				problemSince: null,
				refreshing: false,
				channels: [],
			};
		}

		if (payload.refresh) await this.refresher.refreshIfStale(payload.platform);
		return this.refresher.snapshot(payload.platform);
	}
}
