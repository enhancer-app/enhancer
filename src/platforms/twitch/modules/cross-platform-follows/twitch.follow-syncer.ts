import FollowSyncer from "$shared/module/cross-platform-follows/follow-syncer.ts";
import type SharedDataCache from "$shared/shared-data/shared-data.cache.ts";
import type TwitchUtils from "$twitch/twitch.utils.ts";

export default class TwitchFollowSyncer extends FollowSyncer {
	private static readonly SYNC_COOLDOWN_MS = 2.5 * 60 * 1000;
	private syncInProgress = false;

	constructor(
		private readonly sharedDataCache: SharedDataCache,
		private readonly twitchUtils: TwitchUtils,
	) {
		super("twitch");
	}

	async getFollows() {
		if (this.syncInProgress) {
			this.logger.warn("Sync already in progress, skipping new request");
			return;
		}
		if (this.sharedDataCache.wasRecentlySynced("twitch", TwitchFollowSyncer.SYNC_COOLDOWN_MS)) {
			this.logger.debug("Skipping sync, recently synced by another tab");
			return;
		}
		this.syncInProgress = true;
		try {
			const followList = this.twitchUtils.getUserFollowList();
			await this.sharedDataCache.updateFollows("twitch", followList);
			this.logger.info(`Synced ${followList.length} followed channels`);
		} catch (err) {
			this.logger.error("Failed to sync follows", err);
		} finally {
			this.syncInProgress = false;
		}
	}

	async clearFollows() {
		await this.sharedDataCache.clearFollows("twitch");
	}
}
