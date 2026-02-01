import KickModule from "$kick/kick.module.ts";
import { AdditionalFontsHelper } from "$shared/module/helpers/additional-fonts.helper.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";

export default class AdditionalFontsModule extends KickModule {
	private readonly additionalFontsHelper = new AdditionalFontsHelper(this.enhancerApi());

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
			{
				type: "event",
				event: "extension:joined-channel",
				callback: this.updateFonts.bind(this),
				key: "update-fonts",
			},
		],
	};

	private async run(elements: Element[]) {
		this.additionalFontsHelper.loadFonts(elements, this.additionalFontsHelper.getUsedFonts());
	}

	public async updateFonts() {
		const head = document.querySelector("head");
		if (!head) return;
		this.additionalFontsHelper.loadFonts([head], this.additionalFontsHelper.getUsedFonts());
	}
}
