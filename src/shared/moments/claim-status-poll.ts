import type { ClaimStatus } from "$types/apis/moments.apis.ts";

export const CLAIM_STATUS_POLL_DELAYS = [2000, 5000, 10000, 30000, 30000, 30000];

const TERMINAL_CLAIM_STATUSES: ReadonlySet<ClaimStatus> = new Set([
	"GRANTED",
	"ALREADY_CLAIMED",
	"NOT_LIVE",
	"INVALID_CODE",
	"LIMIT_REACHED",
	"BLOCKED",
	"ERROR",
]);

export function isTerminalClaimStatus(status: ClaimStatus): boolean {
	return TERMINAL_CLAIM_STATUSES.has(status);
}

export function getClaimPollDelay(attempt: number): number | null {
	if (!Number.isInteger(attempt) || attempt < 0) return null;
	if (attempt >= CLAIM_STATUS_POLL_DELAYS.length) return null;
	return CLAIM_STATUS_POLL_DELAYS[attempt];
}
