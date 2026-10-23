import { expect, test } from "bun:test";
import { getFollowsStatusState, isStatusRefreshDue } from "$shared/utils/follows-freshness.utils.ts";
import type { CrossPlatformFollowsSnapshot } from "$types/shared/worker/cross-platform-follows-worker.types.ts";

const NOW = 1_800_000_000_000;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function snapshot(overrides: Partial<CrossPlatformFollowsSnapshot> = {}): CrossPlatformFollowsSnapshot {
	return {
		platform: "twitch",
		synced: true,
		syncedAt: NOW - HOUR,
		checkedAt: NOW - 30_000,
		problem: null,
		problemSince: null,
		refreshing: false,
		channels: [{ login: "a" } as CrossPlatformFollowsSnapshot["channels"][number]],
		...overrides,
	};
}

test("refreshes statuses checked hours ago on the first request after startup", () => {
	expect(isStatusRefreshDue({ statusCheckedAt: NOW - 6 * HOUR, statusProblem: null }, 0, NOW)).toBe(true);
});

test("keeps the 55 second minimum between regular refreshes", () => {
	const record = { statusCheckedAt: NOW - 40_000, statusProblem: null };
	expect(isStatusRefreshDue(record, NOW - 40_000, NOW)).toBe(false);
	expect(isStatusRefreshDue({ ...record, statusCheckedAt: NOW - 56_000 }, NOW - 56_000, NOW)).toBe(true);
});

test("retries a failed refresh after 15 seconds even though the last success is old", () => {
	const record = { statusCheckedAt: NOW - 6 * HOUR, statusProblem: "request-failed" as const };
	expect(isStatusRefreshDue(record, NOW - 5_000, NOW)).toBe(false);
	expect(isStatusRefreshDue(record, NOW - 16_000, NOW)).toBe(true);
});

test("refreshes immediately when the Kick session comes back", () => {
	const record = { statusCheckedAt: NOW - 1_000, statusProblem: "session-missing" as const };
	expect(isStatusRefreshDue(record, NOW - 1_000, NOW, true)).toBe(true);
});

test("treats a status checked within three minutes as current", () => {
	expect(getFollowsStatusState(snapshot(), NOW)).toBe("fresh");
	expect(getFollowsStatusState(snapshot({ checkedAt: NOW - 3 * MINUTE }), NOW)).toBe("fresh");
});

test("marks hours-old statuses as updating while the refresh has not failed for long", () => {
	expect(getFollowsStatusState(snapshot({ checkedAt: NOW - 6 * HOUR }), NOW)).toBe("updating");
	expect(getFollowsStatusState(snapshot({ checkedAt: null }), NOW)).toBe("updating");
	const justFailed = snapshot({ checkedAt: NOW - 6 * HOUR, problem: "request-failed", problemSince: NOW - 10_000 });
	expect(getFollowsStatusState(justFailed, NOW)).toBe("updating");
});

test("reports old statuses as failed once refreshing has failed for a minute", () => {
	const failing = snapshot({ checkedAt: NOW - 6 * HOUR, problem: "request-failed", problemSince: NOW - MINUTE });
	expect(getFollowsStatusState(failing, NOW)).toBe("failed");
});

test("does not flag lists that have nothing to show", () => {
	expect(getFollowsStatusState(undefined, NOW)).toBe("fresh");
	expect(getFollowsStatusState(snapshot({ synced: false, checkedAt: null }), NOW)).toBe("fresh");
	expect(getFollowsStatusState(snapshot({ channels: [], checkedAt: null }), NOW)).toBe("fresh");
});
