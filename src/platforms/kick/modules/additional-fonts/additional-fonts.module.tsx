import KickModule from "$kick/kick.module.ts";
import { AdditionalFontsHelper } from "$shared/module/helpers/additional-fonts.helper.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";

export default class AdditionalFontsModule extends KickModule {
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
		this.additionalFontsHelper.loadFonts(elements, this.getUsedFonts());
	}

	public async updateFonts() {
		const head = document.querySelector("head");
		if (!head) return;
		this.additionalFontsHelper.loadFonts([head], this.getUsedFonts());
	}

	getUsedFonts(): string[] {
		const globalFonts =
			this.enhancerApi()
				.getGlobalChannel()
				?.users.map((user) => user.customFont) ?? [];
		const currentFonts =
			this.enhancerApi()
				.getCurrentChannel()
				?.users.map((user) => user.customFont) ?? [];

		const allRawFonts = [...globalFonts, ...currentFonts];

		const uniqueFonts: string[] = [];
		const seen = new Set<string>();

		for (const font of allRawFonts) {
			if (!font) continue;

			const normalized = font.toLowerCase().trim();

			if (!seen.has(normalized)) {
				seen.add(normalized);
				uniqueFonts.push(font);
			}
		}

		return uniqueFonts;
	}
}
