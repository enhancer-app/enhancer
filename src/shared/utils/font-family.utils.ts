// "inherit" cannot appear in a font-family list, so the fallback has to be a real font stack.
export function fontFamilyWithFallback(font: string, fallback: string): string {
	return `"${font.replace(/["\\]/g, "\\$&")}", ${fallback}`;
}
