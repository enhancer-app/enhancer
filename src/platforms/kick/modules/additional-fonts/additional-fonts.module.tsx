import KickModule from "$kick/kick.module.ts";
import { AdditionalFontsHelper } from "$shared/module/helpers/additional-fonts.helper.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";

export default class AdditionalFontsModule extends KickModule {
	private static FONT_LIST: string[] = ["Cherry Bomb One", "Fredoka", "Darumadrop One", "Dela Gothic One", "Potta One", "Shrikhand"];
	private readonly additionalFontsHelper = new AdditionalFontsHelper();

	readonly config: KickModuleConfig = {
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
		this.additionalFontsHelper.loadFonts(elements, AdditionalFontsModule.FONT_LIST);
	}
}
