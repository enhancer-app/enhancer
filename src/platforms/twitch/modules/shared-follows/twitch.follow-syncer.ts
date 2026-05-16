import FollowSyncer from "$shared/module/shared-follows/follow-syncer.ts";
import type SharedDataCache from "$shared/settings/shared-data.cache.ts";
import type TwitchUtils from "$twitch/twitch.utils.ts";

export default class TwitchFollowSyncer extends FollowSyncer {
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
		this.syncInProgress = true;
		try {
			const followList = this.twitchUtils.getUserFollowList();
			await this.sharedDataCache.updateNestedKey("sharedFollows", "twitch", followList);
			this.logger.info(`Synced ${followList.length} followed channels`);
		} catch (err) {
			this.logger.error("Failed to sync follows", err);
		} finally {
			this.syncInProgress = false;
		}
	}

	async clearFollows() {
		await this.sharedDataCache.updateNestedKey("sharedFollows", "twitch", []);
	}
}
