import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import TwitchModule from "../../twitch.module.ts";

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
		if (elements.length === 0) return;
		const familyQuery = AdditionalFontsModule.FONT_LIST.map((font) => `family=${font.replace(/\s+/g, "+")}`).join("&");
		const url = `https://fonts.googleapis.com/css2?${familyQuery}&display=swap`;
		const fontLink = document.createElement("link");
		fontLink.rel = "stylesheet";
		fontLink.href = url;
		fontLink.setAttribute("media", "print");
		fontLink.setAttribute("onload", "this.media='all'");
		fontLink.classList.add("enhancer-additional-font");
		for (const head of elements) {
			head.appendChild(fontLink.cloneNode(true));
		}
	}
}
