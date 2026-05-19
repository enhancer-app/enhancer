import TwitchFollowSyncer from "$twitch/modules/cross-platform-follows/twitch.follow-syncer.ts";
import TwitchModule from "$twitch/twitch.module.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";

export default class CrossPlatformFollowsModule extends TwitchModule {
	private static readonly SYNC_INTERVAL_MS = 5 * 60 * 1000;
	private readonly twitchFollowsSyncer = new TwitchFollowSyncer(this.sharedData(), this.twitchUtils());

	config: TwitchModuleConfig = {
		name: "cross-platform-follows",
		appliers: [
			{
				type: "event",
				event: "twitch:settings:_syncCrossPlatformFollows",
				callback: async (value) => {
					if (value) await this.startSyncTimer();
					else {
						await this.twitchFollowsSyncer.clearFollows();
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
			() => this.twitchFollowsSyncer.getFollows(),
			CrossPlatformFollowsModule.SYNC_INTERVAL_MS,
		);
		await this.twitchFollowsSyncer.getFollows();
	}

	private stopSyncTimer() {
		if (this.syncFollowsTimer) clearInterval(this.syncFollowsTimer);
	}
}
