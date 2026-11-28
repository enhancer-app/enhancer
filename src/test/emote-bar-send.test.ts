import { describe, expect, test } from "bun:test";
import {
	buildEmoteMessage,
	EMOTE_BAR_DUPLICATE_SUFFIX,
	EMOTE_BAR_DUPLICATE_WINDOW,
	getEmoteClickAction,
	isMacPlatform,
} from "$twitch/modules/emote-bar/emote-bar.send.ts";

const NOW = 1_000_000;

function click(modifiers: { ctrlKey?: boolean; metaKey?: boolean } = {}, type = "click") {
	return { type, ctrlKey: !!modifiers.ctrlKey, metaKey: !!modifiers.metaKey };
}

describe("buildEmoteMessage", () => {
	test("alternates the invisible suffix like 7TV when the same emote is sent repeatedly", () => {
		let previous = null;
		const sent: string[] = [];
		for (let index = 0; index < 4; index++) {
			const message = buildEmoteMessage("Kappa", previous, NOW + index * 1000, false);
			sent.push(message);
			previous = { message, at: NOW + index * 1000 };
		}
		expect(sent).toEqual(["Kappa", "Kappa \u034F", "Kappa", "Kappa \u034F"]);
	});

	test("adds the suffix when the user typed the same emote by hand", () => {
		expect(buildEmoteMessage("Kappa", { message: "  Kappa ", at: NOW }, NOW + 1000, false)).toBe(
			`Kappa${EMOTE_BAR_DUPLICATE_SUFFIX}`,
		);
	});

	test("sends the plain emote after the duplicate window or after a different message", () => {
		const previous = { message: "Kappa", at: NOW };
		expect(buildEmoteMessage("Kappa", previous, NOW + EMOTE_BAR_DUPLICATE_WINDOW, false)).toBe("Kappa");
		expect(buildEmoteMessage("LUL", previous, NOW + 1000, false)).toBe("LUL");
		expect(buildEmoteMessage("Kappa", { message: "Kappa LUL", at: NOW }, NOW + 1000, false)).toBe("Kappa");
	});

	test("never adds the suffix in emote-only mode", () => {
		expect(buildEmoteMessage("Kappa", { message: "Kappa", at: NOW }, NOW + 1000, true)).toBe("Kappa");
	});
});

describe("getEmoteClickAction", () => {
	test("uses Ctrl+Click to send on Windows and Linux", () => {
		expect(getEmoteClickAction(click(), false)).toBe("insert");
		expect(getEmoteClickAction(click({ ctrlKey: true }), false)).toBe("send");
		expect(getEmoteClickAction(click({ metaKey: true }), false)).toBe("insert");
		expect(getEmoteClickAction(click({ ctrlKey: true }, "contextmenu"), false)).toBe("remove");
	});

	test("sends on Cmd+Click and on Ctrl+Click, which macOS reports as a context menu", () => {
		expect(getEmoteClickAction(click({ metaKey: true }), true)).toBe("send");
		expect(getEmoteClickAction(click({ ctrlKey: true }, "contextmenu"), true)).toBe("send");
		expect(getEmoteClickAction(click({ ctrlKey: true }), true)).toBe("none");
		expect(getEmoteClickAction(click({}, "contextmenu"), true)).toBe("remove");
		expect(getEmoteClickAction(click(), true)).toBe("insert");
	});

	test("detects Apple platforms", () => {
		expect(isMacPlatform("MacIntel")).toBe(true);
		expect(isMacPlatform("Win32")).toBe(false);
		expect(isMacPlatform("Linux x86_64")).toBe(false);
	});
});
