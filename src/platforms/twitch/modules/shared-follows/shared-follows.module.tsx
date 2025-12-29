import TwitchFollowSyncer from "$twitch/modules/shared-follows/twitch.follow-syncer.ts";
import TwitchModule from "$twitch/twitch.module.ts";
import type { KickModuleConfig, TwitchModuleConfig } from "$types/shared/module/module.types.ts";

export default class SharedFollowsModule extends TwitchModule {
	private static readonly SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes - centralized sync interval
	private readonly twitchFollowsSyncer = new TwitchFollowSyncer(this.sharedStorageDataService(), this.twitchUtils());

	config: TwitchModuleConfig = {
		name: "shared-follows",
		appliers: [
			{
				type: "event",
				event: "twitch:settings:shareFollowsToOtherPlatforms",
				callback: async (value) => {
					if (value) await this.startSyncTimer();
					else {
						await this.twitchFollowsSyncer.clearFollows();
						this.stopSyncTimer();
					}
				},
				key: "share-follows",
			},
		],
	};

	private syncFollowsTimer: NodeJS.Timeout | undefined;

	async initialize(): Promise<void> {
		const shareFollowsToOtherPlatforms = await this.settingsService().getSettingsKey("shareFollowsToOtherPlatforms");
		if (shareFollowsToOtherPlatforms) await this.startSyncTimer();
	}

	private async startSyncTimer() {
		this.stopSyncTimer();
		this.syncFollowsTimer = setInterval(
			() => this.twitchFollowsSyncer.getFollows(),
			SharedFollowsModule.SYNC_INTERVAL_MS,
		);
		await this.twitchFollowsSyncer.getFollows();
	}

	private stopSyncTimer() {
		if (this.syncFollowsTimer) clearInterval(this.syncFollowsTimer);
	}
}
