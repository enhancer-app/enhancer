import { expect, test } from "bun:test";
import { sanitizeGlobalSettings } from "$shared/settings/global-settings.constants.ts";
import { filterFollowsByPlatform } from "$shared/utils/follows-filter.utils.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";

const channels: { login: string; platform: PlatformType }[] = [
	{ login: "b", platform: "kick" },
	{ login: "a", platform: "twitch" },
	{ login: "c", platform: "kick" },
	{ login: "d", platform: "twitch" },
];

test("keeps every channel in its sorted order when the filter is all", () => {
	expect(filterFollowsByPlatform(channels, "all")).toEqual(channels);
});

test("keeps only the chosen platform without changing the sorted order", () => {
	expect(filterFollowsByPlatform(channels, "kick").map((channel) => channel.login)).toEqual(["b", "c"]);
	expect(filterFollowsByPlatform(channels, "twitch").map((channel) => channel.login)).toEqual(["a", "d"]);
});

test("returns an empty list when nobody is followed on the chosen platform", () => {
	expect(filterFollowsByPlatform(channels.slice(1, 2), "kick")).toEqual([]);
});

test("accepts only known platform filters from saved or imported settings", () => {
	expect(sanitizeGlobalSettings({ followsPlatformFilter: "kick" })).toEqual({ followsPlatformFilter: "kick" });
	expect(sanitizeGlobalSettings({ followsPlatformFilter: "youtube" })).toEqual({});
	expect(sanitizeGlobalSettings({ followsPlatformFilter: true })).toEqual({});
});
