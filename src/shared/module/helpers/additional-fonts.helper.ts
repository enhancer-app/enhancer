import type EnhancerApi from "$shared/apis/enhancer.api.ts";

export class AdditionalFontsHelper {
	private static readonly MAX_FONTS = 50;

	private static cleanupAdditionalFontLinks(elements: Element[]): void {
		for (const head of elements) {
			const existingLinks = head.querySelectorAll("link.enhancer-additional-font");
			existingLinks.forEach((link) => {
				if (link.parentNode) {
					link.parentNode.removeChild(link);
				}
			});
		}
	}

	constructor(private readonly enhancerApi: EnhancerApi) {}

	loadFonts(elements: Element[], fontList: string[]): void {
		if (elements.length === 0) return;

		if (fontList.length === 0) {
			AdditionalFontsHelper.cleanupAdditionalFontLinks(elements);
			return;
		}

		const familyQuery = fontList.map((font) => `family=${font.replace(/\s+/g, "+")}`).join("&");
		const url = `https://fonts.googleapis.com/css2?${familyQuery}&display=swap`;

		const fontLinkElement = document.createElement("link");
		fontLinkElement.rel = "stylesheet";
		fontLinkElement.href = url;
		fontLinkElement.setAttribute("media", "print");
		fontLinkElement.setAttribute("onload", "this.media='all'");
		fontLinkElement.classList.add("enhancer-additional-font");

		for (const head of elements) {
			AdditionalFontsHelper.cleanupAdditionalFontLinks([head]);
			head.appendChild(fontLinkElement.cloneNode(true));
		}
	}

	getUsedFonts(): string[] {
		const allUsers = [
			...(this.enhancerApi.getGlobalChannel()?.users ?? []),
			...(this.enhancerApi.getCurrentChannel()?.users ?? []),
		];

		const uniqueFonts = new Map<string, string>();
		for (const user of allUsers) {
			const font = user.customFont;
			if (!font) {
				continue;
			}

			const normalized = font.toLowerCase().trim();
			if (!uniqueFonts.has(normalized)) {
				uniqueFonts.set(normalized, font);
			}
		}

		return Array.from(uniqueFonts.values());
	}

	loadFontsWithTruncation(elements: Element[], logger: Console): void {
		let fonts = this.getUsedFonts();
		if (fonts.length > AdditionalFontsHelper.MAX_FONTS) {
			logger.warn(`Too many fonts to load (${fonts.length}), truncating to ${AdditionalFontsHelper.MAX_FONTS}`);
			fonts = fonts.slice(0, AdditionalFontsHelper.MAX_FONTS);
		}
		this.loadFonts(elements, fonts);
	}
}
