import { FollowsHomeHelper } from "$shared/module/helpers/follows-home.helper.ts";
import TwitchModule from "$twitch/twitch.module.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";

export default class FollowsHomeModule extends TwitchModule {
	readonly config: TwitchModuleConfig = {
		name: "follows-home",
		appliers: [
			{
				type: "selector",
				selectors: [".root-scrollable__wrapper"],
				callback: (elements) => this.helper.update(elements[0] ?? null),
				key: "follows-home",
			},
			{
				type: "event",
				event: "extension:settings-refresh",
				callback: () => {
					if (!this.isEnabled()) this.helper.unmount();
				},
				key: "follows-home-settings",
			},
		],
		enabled: () => this.isEnabled(),
	};

	private readonly helper = new FollowsHomeHelper({
		platform: "twitch",
		isEnabled: () => this.isEnabled(),
		resolveHomeUrl: async () => {
			const asset = await this.commonUtils().getAssetFile(this.workerService(), "enhancer/logo-128.png");
			return asset ? `${new URL(asset).origin}/home.html` : null;
		},
		navigate: (url) => this.twitchUtils().navigate(url),
	});

	private isEnabled(): boolean {
		const settings = this.globalSettings();
		return settings.crossPlatformFollowsSyncEnabled && settings.followsHomeEnabled;
	}
}
