import { expect, test } from "bun:test";
import { ChangelogNotifier } from "$shared/changelog/changelog.notifier.ts";
import {
	compareVersions,
	parseChangelogFeed,
	selectLatestEntry,
	shouldShowChangelog,
} from "$shared/changelog/changelog.utils.ts";
import { GLOBAL_DEFAULT_SETTINGS, sanitizeGlobalSettings } from "$shared/settings/global-settings.constants.ts";
import type SettingsCache from "$shared/settings/settings.service.ts";
import {
	CHANGELOG_CACHE_KEY,
	CHANGELOG_CACHE_TTL,
	CHANGELOG_PENDING_SEEN_KEY,
	CHANGELOG_RETRY_DELAY,
	ChangelogFeed,
} from "$shared/worker/changelog/changelog.feed.ts";
import type WorkerService from "$shared/worker/worker.service.ts";
import type { ChangelogEntry, ChangelogStorageArea } from "$types/shared/changelog.types.ts";
import type { GlobalSettings } from "$types/shared/settings/global-settings.types.ts";
import { createNanoEvents } from "nanoevents";

const entry = (version: string, notify = true): ChangelogEntry => ({
	id: version.replaceAll(".", "-"),
	version,
	title: `Release ${version}`,
	url: `https://changelog.enhancer.at/${version.replaceAll(".", "-")}/`,
	date: "2026-11-22",
	notify,
});

const FEED = [entry("5.6.0"), entry("5.5.1", false), entry("5.5.0"), entry("5.4.0")];

test("versions compare numerically and ignore the Canary build number", () => {
	expect(compareVersions("5.10.0", "5.9.9")).toBeGreaterThan(0);
	expect(compareVersions("5.5.0", "5.5.0.42")).toBe(0);
	expect(compareVersions("5.4.9", "5.5")).toBeLessThan(0);
	expect(compareVersions("5.5.0-beta", "5.5.0")).toBeNaN();
});

test("the newest notifying entry up to the installed version wins, in any feed order", () => {
	expect(selectLatestEntry(FEED, "5.5.3")?.id).toBe("5-5-0");
	expect(selectLatestEntry(FEED.toReversed(), "5.5.3")?.id).toBe("5-5-0");
	expect(selectLatestEntry(FEED, "5.6.0.7")?.id).toBe("5-6-0");
	expect(selectLatestEntry(FEED, "5.3.4")).toBeNull();
	expect(selectLatestEntry([entry("5.5.1", false)], "5.5.1")).toBeNull();
});

test("malformed feed entries are dropped and a non-list feed is an error", () => {
	const feed = [
		entry("5.5.0"),
		{ ...entry("5.4.0"), url: "javascript:alert(1)" },
		{ ...entry("5.3.0"), version: "next" },
		{ ...entry("5.2.0"), notify: "yes" },
		null,
	];
	expect(parseChangelogFeed(feed).map((item) => item.id)).toEqual(["5-5-0"]);
	expect(() => parseChangelogFeed({ entries: [] })).toThrow();
});

test("the dot shows only for an unseen entry, with notifications on, outside Canary", () => {
	const latest = entry("5.5.0");
	const settings = { whatsNewEnabled: true, lastSeenChangelogId: null };
	expect(shouldShowChangelog(latest, settings, "stable")).toBe(true);
	expect(shouldShowChangelog(latest, { ...settings, lastSeenChangelogId: "5-4-0" }, "stable")).toBe(true);
	expect(shouldShowChangelog(latest, { ...settings, lastSeenChangelogId: "5-5-0" }, "stable")).toBe(false);
	expect(shouldShowChangelog(latest, { ...settings, whatsNewEnabled: false }, "stable")).toBe(false);
	expect(shouldShowChangelog(latest, settings, "canary")).toBe(false);
	expect(shouldShowChangelog(null, settings, "stable")).toBe(false);
});

test("stored settings keep only a valid last seen changelog id", () => {
	expect(GLOBAL_DEFAULT_SETTINGS.whatsNewEnabled).toBe(true);
	expect(GLOBAL_DEFAULT_SETTINGS.lastSeenChangelogId).toBeNull();
	expect(sanitizeGlobalSettings({ lastSeenChangelogId: "5-5-0", whatsNewEnabled: false })).toEqual({
		lastSeenChangelogId: "5-5-0",
		whatsNewEnabled: false,
	});
	expect(sanitizeGlobalSettings({ lastSeenChangelogId: null })).toEqual({ lastSeenChangelogId: null });
	expect(sanitizeGlobalSettings({ lastSeenChangelogId: 5 })).toEqual({});
	expect(sanitizeGlobalSettings({ lastSeenChangelogId: "" })).toEqual({});
});

function setupFeed(options: { version?: string; feed?: () => unknown } = {}) {
	const data: Record<string, unknown> = {};
	const storage: ChangelogStorageArea = {
		get: async (key) => (key in data ? { [key]: structuredClone(data[key]) } : {}),
		set: async (items) => {
			Object.assign(data, structuredClone(items));
		},
		remove: async (key) => {
			delete data[key];
		},
	};
	const clock = { now: 1_000_000 };
	const fetches: number[] = [];
	const seen: string[] = [];
	let respond = options.feed ?? (() => FEED);
	const feed = new ChangelogFeed({
		storage,
		fetchFeed: async () => {
			fetches.push(clock.now);
			return respond();
		},
		markSeen: async (id) => seen.push(id),
		version: options.version ?? "5.5.0",
		now: () => clock.now,
	});
	return {
		feed,
		data,
		clock,
		fetches,
		seen,
		fail: () => {
			respond = () => {
				throw new Error("offline");
			};
		},
		recover: () => {
			respond = () => FEED;
		},
	};
}

test("page loads read the cached feed and only refetch once it is stale", async () => {
	const { feed, clock, fetches } = setupFeed();
	expect((await feed.getLatest())?.id).toBe("5-5-0");
	clock.now += CHANGELOG_CACHE_TTL - 1;
	await feed.getLatest();
	expect(fetches).toHaveLength(1);

	clock.now += 1;
	await feed.getLatest();
	expect(fetches).toHaveLength(2);
});

test("tabs that ask at the same time share one request", async () => {
	const { feed, fetches } = setupFeed();
	await Promise.all([feed.getLatest(), feed.getLatest(), feed.getLatest()]);
	expect(fetches).toHaveLength(1);
});

test("a failed fetch keeps the last good feed and waits before retrying", async () => {
	const { feed, clock, fetches, fail, recover } = setupFeed();
	await feed.getLatest();
	clock.now += CHANGELOG_CACHE_TTL;
	fail();
	expect((await feed.getLatest())?.id).toBe("5-5-0");
	clock.now += CHANGELOG_RETRY_DELAY - 1;
	await feed.getLatest();
	expect(fetches).toHaveLength(2);

	recover();
	clock.now += 1;
	await feed.getLatest();
	expect(fetches).toHaveLength(3);
});

test("without any cached feed a network error means no notice", async () => {
	const { feed, fail } = setupFeed();
	fail();
	expect(await feed.getLatest()).toBeNull();
});

test("an extension update refetches right away, ignoring a fresh cache", async () => {
	const { feed, fetches, seen } = setupFeed();
	await feed.getLatest();
	await feed.handleInstalled("update");
	expect(fetches).toHaveLength(2);
	expect(seen).toEqual([]);
});

test("a first install marks the newest entry as seen so new users get no dot", async () => {
	const { feed, seen } = setupFeed();
	await feed.handleInstalled("install");
	expect(seen).toEqual(["5-5-0"]);
});

test("a first install while offline marks the entry seen on the first successful fetch", async () => {
	const { feed, data, clock, seen, fail, recover } = setupFeed();
	fail();
	await feed.handleInstalled("install");
	expect(seen).toEqual([]);
	expect(data[CHANGELOG_PENDING_SEEN_KEY]).toBe(true);

	recover();
	clock.now += CHANGELOG_RETRY_DELAY;
	expect(await feed.getLatest()).toBeNull();
	expect(seen).toEqual(["5-5-0"]);
	expect(data[CHANGELOG_PENDING_SEEN_KEY]).toBeUndefined();
	expect((await feed.getLatest())?.id).toBe("5-5-0");
	expect(seen).toEqual(["5-5-0"]);
});

test("browser updates do not touch the feed", async () => {
	const { feed, fetches, data } = setupFeed();
	await feed.handleInstalled("chrome_update");
	expect(fetches).toEqual([]);
	expect(data[CHANGELOG_CACHE_KEY]).toBeUndefined();
});

function setupNotifier(channel: "stable" | "canary" = "stable") {
	let global: GlobalSettings = { ...GLOBAL_DEFAULT_SETTINGS };
	const requests: string[] = [];
	const workerService = {
		send: async (action: string) => {
			requests.push(action);
			return { entry: entry("5.5.0") };
		},
	} as unknown as WorkerService;
	const settingsCache = {
		getGlobal: () => global,
		updateGlobal: async (changes: Partial<GlobalSettings>) => {
			global = { ...global, ...changes };
		},
	} as unknown as SettingsCache<any>;
	const notifier = ChangelogNotifier.for(workerService, settingsCache, createNanoEvents(), channel);
	return { notifier, requests, global: () => global };
}

test("dismissing or disabling hides the notice, and showing it again brings it back", async () => {
	const { notifier, global } = setupNotifier();
	await notifier.load();
	expect(notifier.notice.value?.id).toBe("5-5-0");

	await notifier.dismiss();
	expect(global().lastSeenChangelogId).toBe("5-5-0");
	expect(notifier.notice.value).toBeNull();

	await notifier.showAgain();
	expect(notifier.notice.value?.id).toBe("5-5-0");

	await notifier.disable();
	expect(global().whatsNewEnabled).toBe(false);
	expect(notifier.notice.value).toBeNull();

	await notifier.showAgain();
	expect(global()).toMatchObject({ whatsNewEnabled: true, lastSeenChangelogId: null });
	expect(notifier.notice.value?.id).toBe("5-5-0");
});

test("Canary builds never ask for the changelog", async () => {
	const { notifier, requests } = setupNotifier("canary");
	await notifier.load();
	expect(requests).toEqual([]);
	expect(notifier.notice.value).toBeNull();
});
