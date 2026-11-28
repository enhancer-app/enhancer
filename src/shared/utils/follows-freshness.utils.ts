import type {
	CrossPlatformFollowsRecord,
	CrossPlatformFollowsSnapshot,
	FollowsStatusState,
} from "$types/shared/worker/cross-platform-follows-worker.types.ts";

export const STATUS_MAX_AGE_MS = 55_000;
export const STATUS_RETRY_MS = 15_000;
export const STATUS_STALE_MS = 3 * 60_000;
const FAILED_NOTICE_DELAY_MS = 60_000;

export function isStatusRefreshDue(
	record: Pick<CrossPlatformFollowsRecord, "statusCheckedAt" | "statusProblem">,
	lastAttemptAt: number,
	now: number,
	force = false,
): boolean {
	if (force && record.statusProblem === "session-missing") return true;
	if (now - lastAttemptAt < STATUS_RETRY_MS) return false;
	return now - (record.statusCheckedAt ?? 0) >= (force ? STATUS_RETRY_MS : STATUS_MAX_AGE_MS);
}

export function getFollowsStatusState(
	snapshot: CrossPlatformFollowsSnapshot | null | undefined,
	now: number,
): FollowsStatusState {
	if (!snapshot?.synced || snapshot.channels.length === 0) return "fresh";
	if (snapshot.checkedAt !== null && now - snapshot.checkedAt <= STATUS_STALE_MS) return "fresh";
	const failingSince = snapshot.problem ? (snapshot.problemSince ?? now) : null;
	return failingSince !== null && now - failingSince >= FAILED_NOTICE_DELAY_MS ? "failed" : "updating";
}
