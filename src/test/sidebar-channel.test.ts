import { expect, test } from "bun:test";
import { getLoginFromHref, parseViewerCount } from "$shared/utils/sidebar-channel.utils.ts";

test("parses viewer counts as Twitch and Kick print them", () => {
	expect(parseViewerCount("1049")).toBe(1049);
	expect(parseViewerCount("15\u00a0884")).toBe(15884);
	expect(parseViewerCount("Na żywo | 16\u00a0134 widzów")).toBe(16134);
	expect(parseViewerCount("1,2 tys.")).toBe(1200);
	expect(parseViewerCount("12.3K")).toBe(12300);
	expect(parseViewerCount("1.5M viewers")).toBe(1_500_000);
	expect(parseViewerCount("2,1 mln")).toBe(2_100_000);
	expect(parseViewerCount("")).toBe(0);
	expect(parseViewerCount(null)).toBe(0);
});

test("reads the channel login from sidebar links", () => {
	expect(getLoginFromHref("/Kasix")).toBe("kasix");
	expect(getLoginFromHref("https://kick.com/xqc")).toBe("xqc");
	expect(getLoginFromHref("/directory/category/fortnite")).toBeNull();
	expect(getLoginFromHref(null)).toBeNull();
});
