import type { Logger } from "$shared/logger/logger.ts";
import type { SharedDatabase } from "$shared/worker/database/shared.database.ts";
import type { CrossPlatformFollowsRefresher } from "$shared/worker/cross-platform-follows/cross-platform-follows.refresher.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { SettingsDatabase } from "$shared/worker/settings/settings.database.ts";
import type { FollowedChannel, SyncFollowsPayload } from "$types/shared/worker/cross-platform-follows-worker.types.ts";

export class SyncFollowsHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly database: SharedDatabase,
		private readonly settingsDatabase: SettingsDatabase,
		private readonly refresher: CrossPlatformFollowsRefresher,
	) {
		super(logger);
	}

	async handle(payload: SyncFollowsPayload): Promise<{ success: true }> {
		if (!payload || !["kick", "twitch"].includes(payload.platform) || !Array.isArray(payload.channels)) {
			throw new Error("Invalid payload for syncFollows action. 'platform' and 'channels' are required.");
		}

		const settings = await this.settingsDatabase.getGlobalSettings();
		if (settings.crossPlatformFollowsSyncEnabled !== true) {
			throw new Error("Follow sharing is disabled");
		}

		const channels = new Map<string, FollowedChannel>();
		for (const channel of payload.channels) {
			const login = typeof channel?.login === "string" ? channel.login.trim().toLowerCase() : "";
			if (!login || channels.has(login)) continue;
			channels.set(login, {
				login,
				displayName: typeof channel.displayName === "string" && channel.displayName ? channel.displayName : login,
				avatarUrl: typeof channel.avatarUrl === "string" ? channel.avatarUrl : null,
			});
		}

		const current = await this.database.getFollows(payload.platform);
		await this.database.putFollows({
			platform: payload.platform,
			channels: [...channels.values()],
			syncedAt: Date.now(),
			statusCheckedAt: current?.statusCheckedAt ?? null,
			statusProblem: current?.statusProblem ?? null,
			statusProblemSince: current?.statusProblemSince ?? null,
		});
		this.logger.debug(`Synced ${channels.size} ${payload.platform} follows`);

		await this.refresher.broadcast(payload.platform);
		await this.refresher.refreshIfStale(payload.platform, true);
		return { success: true };
	}
}
