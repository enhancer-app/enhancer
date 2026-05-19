import KickModule from "$kick/kick.module.ts";
import KickFollowSyncer from "$kick/modules/cross-platform-follows/kick.follow-syncer.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";

export default class CrossPlatformFollowsModule extends KickModule {
	private static readonly SYNC_INTERVAL_MS = 5 * 60 * 1000;
	private readonly kickFollowsSyncer = new KickFollowSyncer(this.sharedData(), this.commonUtils());

	config: KickModuleConfig = {
		name: "cross-platform-follows",
		appliers: [
			{
				type: "event",
				event: "kick:settings:_syncCrossPlatformFollows",
				callback: async (value) => {
					if (value) await this.startSyncTimer();
					else {
						await this.kickFollowsSyncer.clearFollows();
						this.stopSyncTimer();
					}
				},
				key: "sync-cross-platform-follows",
			},
		],
	};

	private syncFollowsTimer: NodeJS.Timeout | undefined;

	async initialize(): Promise<void> {
		const _syncCrossPlatformFollows = this.settings()._syncCrossPlatformFollows;
		if (_syncCrossPlatformFollows) await this.startSyncTimer();
	}

	private async startSyncTimer() {
		this.stopSyncTimer();
		this.syncFollowsTimer = setInterval(
			() => this.kickFollowsSyncer.getFollows(),
			CrossPlatformFollowsModule.SYNC_INTERVAL_MS,
		);
		await this.kickFollowsSyncer.getFollows();
	}

	private stopSyncTimer() {
		if (this.syncFollowsTimer) clearInterval(this.syncFollowsTimer);
	}
}
