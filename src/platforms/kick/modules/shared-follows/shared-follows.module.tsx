import KickModule from "$kick/kick.module.ts";
import KickFollowSyncer from "$kick/modules/shared-follows/kick.follow-syncer.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";

export default class SharedFollowsModule extends KickModule {
	private static readonly SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes - centralized sync interval
	private readonly kickFollowsSyncer = new KickFollowSyncer(this.sharedStorageDataService(), this.commonUtils());

	config: KickModuleConfig = {
		name: "shared-follows",
		appliers: [
			{
				type: "event",
				event: "kick:settings:shareFollowsToOtherPlatforms",
				callback: async (value) => {
					if (value) await this.startSyncTimer();
					else {
						await this.kickFollowsSyncer.clearFollows();
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
			() => this.kickFollowsSyncer.getFollows(),
			SharedFollowsModule.SYNC_INTERVAL_MS,
		);
		await this.kickFollowsSyncer.getFollows();
	}

	private stopSyncTimer() {
		if (this.syncFollowsTimer) clearInterval(this.syncFollowsTimer);
	}
}
