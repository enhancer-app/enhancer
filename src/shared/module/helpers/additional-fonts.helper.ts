import type EnhancerApi from "$shared/apis/enhancer.api.ts";

export class AdditionalFontsHelper {
	constructor(private readonly enhancerApi: EnhancerApi) {}

	loadFonts(elements: Element[], fontList: string[]): void {
		if (elements.length === 0 || fontList.length === 0) return;

		const familyQuery = fontList.map((font) => `family=${font.replace(/\s+/g, "+")}`).join("&");
		const url = `https://fonts.googleapis.com/css2?${familyQuery}&display=swap`;

		const newFontLink = document.createElement("link");
		newFontLink.rel = "stylesheet";
		newFontLink.href = url;
		// doing this magic so it won't impact the main page load
		newFontLink.setAttribute("media", "print");
		newFontLink.setAttribute("onload", "this.media='all'");
		newFontLink.classList.add("enhancer-additional-font");

		for (const head of elements) {
			const existingLink = head.querySelector("link.enhancer-additional-font") as HTMLLinkElement;
			if (existingLink) {
				existingLink.href = url;
			} else {
				head.appendChild(newFontLink.cloneNode(true));
			}
		}
	}

	getUsedFonts(): string[] {
		const globalFonts = this.enhancerApi.getGlobalChannel()?.users.map((user) => user.customFont) ?? [];
		const currentFonts = this.enhancerApi.getCurrentChannel()?.users.map((user) => user.customFont) ?? [];

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
