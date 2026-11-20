import type EnhancerApi from "$shared/apis/enhancer.api.ts";
import type { Logger } from "$shared/logger/logger.ts";

export class AdditionalFontsHelper {
	private static readonly MAX_FONTS = 50;
	private static readonly FONTS_BASE_URL = "https://fonts.enhancer.at";
	private static readonly LINK_CLASS = "enhancer-additional-font";

	static fontUrl(font: string): string {
		const family = encodeURIComponent(font.trim()).replace(/%20/g, "+");
		return `${AdditionalFontsHelper.FONTS_BASE_URL}/css2?family=${family}&display=swap`;
	}

	constructor(private readonly enhancerApi: EnhancerApi) {}

	loadFonts(elements: Element[], fontList: string[]): void {
		const wanted = new Map(fontList.map((font) => [AdditionalFontsHelper.fontUrl(font), font]));

		for (const head of elements) {
			const existing = new Set<string>();
			head.querySelectorAll<HTMLLinkElement>(`link.${AdditionalFontsHelper.LINK_CLASS}`).forEach((link) => {
				const url = link.getAttribute("href") ?? "";
				if (wanted.has(url) && !existing.has(url)) {
					existing.add(url);
				} else {
					link.remove();
				}
			});

			for (const [url, font] of wanted) {
				if (existing.has(url)) continue;
				const fontLinkElement = document.createElement("link");
				fontLinkElement.rel = "stylesheet";
				fontLinkElement.href = url;
				fontLinkElement.media = "print";
				fontLinkElement.dataset.font = font;
				fontLinkElement.classList.add(AdditionalFontsHelper.LINK_CLASS);
				fontLinkElement.addEventListener("load", () => {
					fontLinkElement.media = "all";
				});
				head.appendChild(fontLinkElement);
			}
		}
	}

	getUsedFonts(): string[] {
		const uniqueFonts = new Map<string, string>();
		for (const font of this.enhancerApi.getCustomFonts()) {
			const normalized = font.toLowerCase().trim();
			if (!uniqueFonts.has(normalized)) {
				uniqueFonts.set(normalized, font);
			}
		}

		return Array.from(uniqueFonts.values());
	}

	loadFontsWithTruncation(elements: Element[], logger: Logger): void {
		let fonts = this.getUsedFonts();
		if (fonts.length > AdditionalFontsHelper.MAX_FONTS) {
			logger.warn(`Too many fonts to load (${fonts.length}), truncating to ${AdditionalFontsHelper.MAX_FONTS}`);
			fonts = fonts.slice(0, AdditionalFontsHelper.MAX_FONTS);
		}
		this.loadFonts(elements, fonts);
	}
}
