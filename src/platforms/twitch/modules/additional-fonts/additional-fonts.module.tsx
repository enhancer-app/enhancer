import { AdditionalFontsHelper } from "$shared/module/helpers/additional-fonts.helper.ts";
import TwitchModule from "$twitch/twitch.module.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";

export default class AdditionalFontsModule extends TwitchModule {
	private readonly additionalFontsHelper = new AdditionalFontsHelper(this.enhancerApi());
	private static readonly MAX_FONTS = 50;

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
			{
				type: "event",
				event: "extension:joined-channel",
				callback: this.updateFonts.bind(this),
				key: "update-fonts",
			},
		],
	};

	private loadFontsWithTruncation(elements: Element[]) {
		let fonts = this.additionalFontsHelper.getUsedFonts();
		if (fonts.length > AdditionalFontsModule.MAX_FONTS) {
			this.logger.warn(`Too many fonts to load (${fonts.length}), truncating to ${AdditionalFontsModule.MAX_FONTS}`);
			fonts = fonts.slice(0, AdditionalFontsModule.MAX_FONTS);
		}
		this.additionalFontsHelper.loadFonts(elements, fonts);
	}

	private async run(elements: Element[]) {
		this.loadFontsWithTruncation(elements);
	}

	public async updateFonts() {
		const head = document.querySelector("head");
		if (!head) return;
		this.loadFontsWithTruncation([head]);
	}
}
