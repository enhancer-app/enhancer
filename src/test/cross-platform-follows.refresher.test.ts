import { afterEach, expect, test } from "bun:test";
import { CrossPlatformFollowsRefresher } from "$shared/worker/cross-platform-follows/cross-platform-follows.refresher.ts";
import type {
	ChannelStatusRecord,
	CrossPlatformFollowsRecord,
	CrossPlatformFollowsSnapshot,
} from "$types/shared/worker/cross-platform-follows-worker.types.ts";

const HOUR = 60 * 60_000;
const originalFetch = globalThis.fetch;
const originalChrome = (globalThis as { chrome?: unknown }).chrome;

afterEach(() => {
	globalThis.fetch = originalFetch;
	(globalThis as { chrome?: unknown }).chrome = originalChrome;
});

function setup() {
	const checkedAt = Date.now() - 6 * HOUR;
	let record: CrossPlatformFollowsRecord = {
		platform: "twitch",
		channels: [
			{ login: "old_live", displayName: "Old Live", avatarUrl: null },
			{ login: "now_live", displayName: "Now Live", avatarUrl: null },
		],
		syncedAt: checkedAt,
		statusCheckedAt: checkedAt,
		statusProblem: null,
		statusProblemSince: null,
	};
	let statuses: ChannelStatusRecord[] = [
		{
			id: "twitch:old_live",
			platform: "twitch",
			login: "old_live",
			displayName: "Old Live",
			avatarUrl: null,
			live: true,
			viewers: 500,
			title: "Last night",
			category: "Just Chatting",
			thumbnailUrl: null,
			startedAt: checkedAt - HOUR,
			lastLiveAt: checkedAt,
			checkedAt,
		},
	];
	const database = {
		getFollows: async () => record,
		putFollows: async (next: CrossPlatformFollowsRecord) => void (record = next),
		getStatuses: async () => statuses,
		replaceStatuses: async (_platform: string, next: ChannelStatusRecord[]) => void (statuses = next),
		getPins: async () => [],
	};
	const broadcasts: CrossPlatformFollowsSnapshot[] = [];
	(globalThis as { chrome?: unknown }).chrome = {
		runtime: {
			sendMessage: async (message: { payload: CrossPlatformFollowsSnapshot }) => {
				broadcasts.push(message.payload);
			},
		},
		tabs: { query: async () => [] },
	};
	const logger = { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} };
	const refresher = new CrossPlatformFollowsRefresher(
		logger as never,
		database as never,
		{ getPlatformWatchtime: async () => [] } as never,
		{ hasCredential: async () => false } as never,
	);
	const settle = async () => {
		await Promise.all(refresher["inFlight"].values());
		await new Promise((resolve) => setTimeout(resolve, 0));
	};
	return { refresher, settle, broadcasts, checkedAt, getRecord: () => record, getStatuses: () => statuses };
}

function respondWithTwitch(users: unknown[]) {
	globalThis.fetch = (async () => Response.json({ data: { users } })) as unknown as typeof fetch;
}

test("keeps the last known statuses and their age when the startup refresh fails", async () => {
	const { refresher, settle, broadcasts, checkedAt, getRecord, getStatuses } = setup();
	globalThis.fetch = (async () => {
		throw new TypeError("Failed to fetch");
	}) as unknown as typeof fetch;

	await refresher.refreshIfStale("twitch");
	await settle();

	expect(getStatuses().map((status) => [status.login, status.live])).toEqual([["old_live", true]]);
	expect(getRecord().channels).toHaveLength(2);
	expect(getRecord().statusCheckedAt).toBe(checkedAt);
	expect(getRecord().statusProblem).toBe("request-failed");
	expect(broadcasts.at(-1)).toMatchObject({ checkedAt, problem: "request-failed", refreshing: false });
	expect(broadcasts.at(-1)?.channels.map((channel) => channel.login)).toEqual(["old_live", "now_live"]);
});

test("waits 15 seconds before retrying a failed refresh instead of trusting the failure", async () => {
	const { refresher, settle } = setup();
	let requests = 0;
	globalThis.fetch = (async () => {
		requests++;
		throw new TypeError("Failed to fetch");
	}) as unknown as typeof fetch;

	await refresher.refreshIfStale("twitch");
	await settle();
	await refresher.refreshIfStale("twitch");
	await settle();
	expect(requests).toBe(1);

	refresher["attemptedAt"].set("twitch", Date.now() - 16_000);
	await refresher.refreshIfStale("twitch");
	await settle();
	expect(requests).toBe(2);
});

test("replaces hours-old live statuses and broadcasts the fresh list once the network is back", async () => {
	const { refresher, settle, broadcasts, checkedAt, getRecord } = setup();
	respondWithTwitch([
		{ login: "old_live", displayName: "Old Live", profileImageURL: null, stream: null, lastBroadcast: null },
		{
			login: "now_live",
			displayName: "Now Live",
			profileImageURL: null,
			stream: { viewersCount: 42, title: "Morning", createdAt: null, previewImageURL: null, game: null },
			lastBroadcast: null,
		},
	]);

	await refresher.refreshIfStale("twitch");
	await settle();

	expect(getRecord().statusCheckedAt).toBeGreaterThan(checkedAt);
	expect(getRecord().statusProblem).toBeNull();
	const live = broadcasts
		.at(-1)
		?.channels.filter((channel) => channel.live)
		.map((channel) => channel.login);
	expect(live).toEqual(["now_live"]);
});
