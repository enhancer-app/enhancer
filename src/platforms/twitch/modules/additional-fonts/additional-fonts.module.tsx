import TwitchModule from "$twitch/twitch.module.ts";
import { AdditionalFontsHelper } from "$shared/module/helpers/additional-fonts.helper.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";

export default class AdditionalFontsModule extends TwitchModule {
	private static FONT_LIST: string[] = ["Cherry Bomb One", "Fredoka", "Darumadrop One", "Dela Gothic One", "Potta One"];

	readonly config: TwitchModuleConfig = {
		name: "additional-fonts",
		isModuleEnabledCallback: async () => this.settingsService().getSettingsKey("loadAdditionalFonts"),
		appliers: [
			{
				type: "selector",
				key: "additional-fonts",
				selectors: ["head"],
				callback: this.run.bind(this),
				once: true,
			},
		],
	};

	private async run(elements: Element[]) {
		AdditionalFontsHelper.loadFonts(elements, AdditionalFontsModule.FONT_LIST);
	}
}
