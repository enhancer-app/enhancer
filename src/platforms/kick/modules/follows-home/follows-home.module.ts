import KickModule from "$kick/kick.module.ts";
import { FollowsHomeHelper } from "$shared/module/helpers/follows-home.helper.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";

export default class FollowsHomeModule extends KickModule {
	readonly config: KickModuleConfig = {
		name: "follows-home",
		appliers: [
			{
				type: "selector",
				selectors: ["#main-container > main"],
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
		platform: "kick",
		isEnabled: () => this.isEnabled(),
		resolveHomeUrl: async () => {
			const asset = await this.commonUtils().getAssetFile(this.workerService(), "enhancer/logo-128.png");
			return asset ? `${new URL(asset).origin}/home.html` : null;
		},
		navigate: (url) => this.kickUtils().navigate(url),
	});

	private isEnabled(): boolean {
		const settings = this.globalSettings();
		return settings.crossPlatformFollowsSyncEnabled && settings.followsHomeEnabled;
	}
}
