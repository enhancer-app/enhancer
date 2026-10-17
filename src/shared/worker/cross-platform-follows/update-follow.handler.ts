import type { Logger } from "$shared/logger/logger.ts";
import type { CrossPlatformFollowsRefresher } from "$shared/worker/cross-platform-follows/cross-platform-follows.refresher.ts";
import type { SharedDatabase } from "$shared/worker/database/shared.database.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { SettingsDatabase } from "$shared/worker/settings/settings.database.ts";
import type { UpdateFollowPayload } from "$types/shared/worker/cross-platform-follows-worker.types.ts";

export class UpdateFollowHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly database: SharedDatabase,
		private readonly settingsDatabase: SettingsDatabase,
		private readonly refresher: CrossPlatformFollowsRefresher,
	) {
		super(logger);
	}

	async handle(payload: UpdateFollowPayload): Promise<{ success: true }> {
		const login = typeof payload?.channel?.login === "string" ? payload.channel.login.trim().toLowerCase() : "";
		if (!payload || !["kick", "twitch"].includes(payload.platform) || !login) {
			throw new Error("Invalid payload for updateFollow action. 'platform' and 'channel.login' are required.");
		}

		const settings = await this.settingsDatabase.getGlobalSettings();
		const record = await this.database.getFollows(payload.platform);
		if (!settings.crossPlatformFollowsSyncEnabled || !record) return { success: true };

		const channels = record.channels.filter((channel) => channel.login !== login);
		if (payload.followed) {
			channels.push({
				login,
				displayName: payload.channel.displayName || login,
				avatarUrl: payload.channel.avatarUrl ?? null,
			});
		} else {
			await this.database.deleteStatus(payload.platform, login);
		}
		await this.database.putFollows({ ...record, channels });
		this.logger.debug(`${payload.followed ? "Added" : "Removed"} ${payload.platform} follow: ${login}`);

		await this.refresher.broadcast(payload.platform);
		if (payload.followed) await this.refresher.refreshNow(payload.platform);
		return { success: true };
	}
}
