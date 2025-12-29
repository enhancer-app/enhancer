export class AdditionalFontsHelper {
	loadFonts(elements: Element[], fontList: string[]): void {
		if (elements.length === 0) return;
		const familyQuery = fontList.map((font) => `family=${font.replace(/\s+/g, "+")}`).join("&");
		const url = `https://fonts.googleapis.com/css2?${familyQuery}&display=swap`;
		const fontLink = document.createElement("link");
		fontLink.rel = "stylesheet";
		fontLink.href = url;
		// doing this magic so it won't impact the main page load
		fontLink.setAttribute("media", "print");
		fontLink.setAttribute("onload", "this.media='all'");
		fontLink.classList.add("enhancer-additional-font");
		for (const head of elements) {
			head.appendChild(fontLink.cloneNode(true));
		}
	}
}
