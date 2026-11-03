import { expect, test } from "bun:test";
import { fontFamilyWithFallback } from "$shared/utils/font-family.utils.ts";

test("quotes the font and keeps a usable fallback stack", () => {
	expect(fontFamilyWithFallback("Special Elite", "Inter, sans-serif")).toBe('"Special Elite", Inter, sans-serif');
	expect(fontFamilyWithFallback('Odd"Name', "sans-serif")).toBe('"Odd\\"Name", sans-serif');
	expect(fontFamilyWithFallback("Bungee", "sans-serif")).not.toContain("inherit");
});
