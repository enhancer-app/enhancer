import { expect, test } from "bun:test";
import { filterFollowsByPlatform } from "$shared/utils/follows-filter.utils.ts";
import { mergeLinkedChannels } from "$shared/utils/follows-links.utils.ts";
import { filterFollowsBySearch } from "$shared/utils/follows-search.utils.ts";
import type { SidebarChannel } from "$types/shared/components/cross-platform-follows.component.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";

function channel(platform: PlatformType, login: string, displayName = login): SidebarChannel {
	return {
		platform,
		login,
		displayName,
		avatarUrl: null,
		live: false,
		viewers: 0,
		title: null,
		category: null,
		thumbnailUrl: null,
		startedAt: null,
		lastLiveAt: null,
		checked: true,
		pinned: false,
		watchtime: 0,
		watchedAt: null,
	};
}

const logins = (channels: SidebarChannel[]) => channels.map((item) => `${item.platform}:${item.login}`);

const channels = [
	channel("twitch", "xqc", "xQc"),
	channel("kick", "adinross", "AdinRoss"),
	channel("twitch", "kaicenat", "KaiCenat"),
	channel("kick", "trainwreckstv", "Trainwreckstv"),
];

test("matches the login or the display name without case sensitivity", () => {
	expect(logins(filterFollowsBySearch(channels, "XQ"))).toEqual(["twitch:xqc"]);
	expect(logins(filterFollowsBySearch([channel("twitch", "user_123", "ÜberName")], "überna"))).toEqual([
		"twitch:user_123",
	]);
	expect(logins(filterFollowsBySearch(channels, "Cenat"))).toEqual(["twitch:kaicenat"]);
});

test("keeps the sorted order and every channel for a blank query", () => {
	expect(filterFollowsBySearch(channels, "   ")).toEqual(channels);
	expect(logins(filterFollowsBySearch(channels, "a"))).toEqual([
		"kick:adinross",
		"twitch:kaicenat",
		"kick:trainwreckstv",
	]);
});

test("returns nothing when no channel matches", () => {
	expect(filterFollowsBySearch(channels, "nobody")).toEqual([]);
});

test("matches a linked streamer by the channel on the platform that is not shown", () => {
	const merged = mergeLinkedChannels(
		[channel("twitch", "streamer_tv", "StreamerTV"), channel("kick", "realstreamer", "RealStreamer")],
		[{ twitch: "streamer_tv", kick: "realstreamer", primary: "twitch" }],
	);

	expect(merged).toHaveLength(1);
	expect(merged[0].platform).toBe("twitch");
	expect(filterFollowsBySearch(merged, "realstr")).toEqual(merged);
	expect(filterFollowsBySearch(merged, "kick")).toEqual([]);
});

test("narrows the platform filter's result instead of replacing it", () => {
	const result = filterFollowsBySearch(filterFollowsByPlatform(channels, "kick"), "a");
	expect(logins(result)).toEqual(["kick:adinross", "kick:trainwreckstv"]);
});
