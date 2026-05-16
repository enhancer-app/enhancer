// import TwitchModule from "$twitch/twitch.module.ts";
// import { COMMON_KEYS } from "$types/shared/common/common.types.ts";
// import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
//
// export default class ExposeFollowsModule extends TwitchModule {
// 	config: TwitchModuleConfig = {
// 		name: "expose-follows",
// 		appliers: [
// 			{
// 				type: "event",
// 				event: "extension:start",
// 				callback: this.syncFollowedToCommon.bind(this),
// 				key: "expose-follows",
// 			},
// 		],
// 		isModuleEnabledCallback: async () => await this.settingsService().getSettingsKey("exposeFollowedToOthers"),
// 	};
//
// 	private async syncFollowedToCommon() {
// 		try {
// 			const twitchFollowList = this.twitchUtils().getUserFollowList();
// 			this.logger.debug("Follow list:", twitchFollowList);
// 			if (twitchFollowList.length === 0) return;
// 			await this.workerService().send("setCommon", {
// 				platform: "kick",
// 				key: COMMON_KEYS.kick.twitchStreamers,
// 				value: twitchFollowList,
// 			});
// 			this.logger.debug("Exposed Twitch followed channels to common store (for Kick)", twitchFollowList);
// 		} catch (error) {
// 			this.logger.warn("Failed to sync followed channels:", error);
// 		}
// 	}
// }
