import { expect, test } from "bun:test";
import { getFollowsComparator } from "$shared/components/cross-platform-follows/platform.shared.tsx";
import {
	getChannelLinkId,
	getConflictingLinkIds,
	getPinTargets,
	matchesFollowsPlatform,
	mergeLinkedChannels,
	pickLinkedPlatform,
	searchLinkCandidates,
} from "$shared/utils/follows-links.utils.ts";
import type { SidebarChannel } from "$types/shared/components/cross-platform-follows.component.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { ChannelLink, ChannelLinkRecord } from "$types/shared/worker/channel-links-worker.types.ts";

const NOW = 1_000_000_000;

function channel(platform: PlatformType, login: string, changes: Partial<SidebarChannel> = {}): SidebarChannel {
	return {
		platform,
		login,
		displayName: login,
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
		...changes,
	};
}

function link(twitch: string, kick: string, primary: PlatformType = "twitch"): ChannelLink {
	return { twitch, kick, primary };
}

function record(twitch: string, kick: string): ChannelLinkRecord {
	return { ...link(twitch, kick), id: getChannelLinkId(twitch, kick), updatedAt: 0 };
}

const keys = (channels: SidebarChannel[]) => channels.map((item) => `${item.platform}:${item.login}`);

test("shows the preferred platform when live on both or on neither", () => {
	const bothLive = {
		twitch: channel("twitch", "a", { live: true, viewers: 500 }),
		kick: channel("kick", "a", { live: true, viewers: 5 }),
	};
	const bothOffline = { twitch: channel("twitch", "a", { lastLiveAt: NOW }), kick: channel("kick", "a") };

	expect(pickLinkedPlatform(bothLive, "kick")).toBe("kick");
	expect(pickLinkedPlatform(bothOffline, "kick")).toBe("kick");
});

test("shows the platform where the streamer is live when live on only one", () => {
	const twitch = channel("twitch", "a");
	const kick = channel("kick", "a", { live: true, viewers: 10 });

	expect(pickLinkedPlatform({ twitch, kick }, "twitch")).toBe("kick");
});

test("merges a linked pair into one entry with only the shown platform's stream data", () => {
	const channels = [
		channel("twitch", "xqc", { live: true, viewers: 100, watchtime: 100, watchedAt: NOW - 5 }),
		channel("twitch", "other"),
		channel("kick", "xqc_kick", { live: true, viewers: 30, pinned: true, watchtime: 50, watchedAt: NOW }),
	];

	const merged = mergeLinkedChannels(channels, [link("xqc", "xqc_kick", "kick")]);

	expect(keys(merged)).toEqual(["kick:xqc_kick", "twitch:other"]);
	expect(merged[0]).toMatchObject({ live: true, viewers: 30, pinned: true, watchtime: 150, watchedAt: NOW });
	expect(merged[0].linked?.channels.twitch.login).toBe("xqc");
});

test("ignores links to channels that are no longer followed", () => {
	const channels = [channel("twitch", "a"), channel("kick", "b")];

	expect(keys(mergeLinkedChannels(channels, [link("gone", "b"), link("a", "gone")]))).toEqual(["twitch:a", "kick:b"]);
});

test("sorts a linked streamer by the shown platform's viewers", () => {
	const channels = [
		channel("twitch", "small", { live: true, viewers: 120 }),
		channel("twitch", "multi", { live: true, viewers: 200 }),
		channel("kick", "multi", { live: true, viewers: 60 }),
		channel("kick", "offline", { lastLiveAt: NOW }),
	];

	const merged = mergeLinkedChannels(channels, [link("multi", "multi", "kick")]);
	const sorted = [...merged].sort(getFollowsComparator("viewers-desc", NOW));

	expect(keys(sorted)).toEqual(["twitch:small", "kick:multi", "kick:offline"]);
});

test("a pin on either linked channel keeps the streamer above other offline channels", () => {
	const channels = [
		channel("twitch", "recent", { lastLiveAt: NOW }),
		channel("twitch", "pinned", { lastLiveAt: NOW - 100 }),
		channel("kick", "pinned", { pinned: true }),
	];

	const merged = mergeLinkedChannels(channels, [link("pinned", "pinned")]);
	const sorted = [...merged].sort(getFollowsComparator("recommended", NOW));

	expect(keys(sorted)).toEqual(["twitch:pinned", "twitch:recent"]);
});

test("searches only unlinked follows on the other platform, exact matches first", () => {
	const channels = mergeLinkedChannels(
		[
			channel("kick", "xqcfan"),
			channel("kick", "xqc"),
			channel("kick", "bigxqc", { live: true }),
			channel("kick", "linked_xqc"),
			channel("twitch", "linked"),
			channel("twitch", "xqc"),
			channel("kick", "other", { displayName: "XQC Clips" }),
		],
		[link("linked", "linked_xqc")],
	);

	expect(keys(searchLinkCandidates(channels, "kick", " XQC "))).toEqual([
		"kick:xqc",
		"kick:other",
		"kick:xqcfan",
		"kick:bigxqc",
	]);
});

test("linking a channel replaces its previous links", () => {
	const links = [record("a", "old"), record("other", "b"), record("c", "d")];

	expect(getConflictingLinkIds(links, record("a", "b"))).toEqual(["a:old", "other:b"]);
	expect(getConflictingLinkIds(links, record("c", "d"))).toEqual([]);
});

test("a linked streamer matches the platform filter of the platform it shows", () => {
	const channels = [channel("twitch", "a"), channel("kick", "a", { live: true, viewers: 1 })];
	const [entry] = mergeLinkedChannels(channels, [link("a", "a")]);

	expect(matchesFollowsPlatform(entry, "kick")).toBe(true);
	expect(matchesFollowsPlatform(entry, "twitch")).toBe(false);
});

test("the home page keeps each entry's refresh time when it merges a linked pair", () => {
	const channels = [
		{ ...channel("twitch", "a"), checkedAt: 1 },
		{ ...channel("kick", "a", { live: true }), checkedAt: 2 },
	];

	const [entry] = mergeLinkedChannels(channels, [link("a", "a")]);

	expect(entry.platform).toBe("kick");
	expect(entry.checkedAt).toBe(2);
});

test("pinning a linked streamer pins both of their channels", () => {
	const [entry] = mergeLinkedChannels([channel("twitch", "a"), channel("kick", "b")], [link("a", "b")]);

	expect(keys(getPinTargets(entry))).toEqual(["twitch:a", "kick:b"]);
	expect(keys(getPinTargets(channel("kick", "solo")))).toEqual(["kick:solo"]);
});
