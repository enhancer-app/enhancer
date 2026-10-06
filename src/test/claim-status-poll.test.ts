import { expect, test } from "bun:test";
import {
	CLAIM_STATUS_POLL_DELAYS,
	getClaimPollDelay,
	isTerminalClaimStatus,
} from "$shared/moments/claim-status-poll.ts";

test("treats outcome statuses as terminal and NONE as pending", () => {
	for (const status of [
		"GRANTED",
		"ALREADY_CLAIMED",
		"NOT_LIVE",
		"INVALID_CODE",
		"LIMIT_REACHED",
		"BLOCKED",
		"ERROR",
	] as const) {
		expect(isTerminalClaimStatus(status)).toBe(true);
	}
	expect(isTerminalClaimStatus("NONE")).toBe(false);
});

test("backs off 2s, 5s, 10s, then 30s", () => {
	expect(getClaimPollDelay(0)).toBe(2000);
	expect(getClaimPollDelay(1)).toBe(5000);
	expect(getClaimPollDelay(2)).toBe(10000);
	expect(getClaimPollDelay(3)).toBe(30000);
	expect(getClaimPollDelay(5)).toBe(30000);
});

test("stops polling after the delay budget is exhausted", () => {
	expect(getClaimPollDelay(CLAIM_STATUS_POLL_DELAYS.length)).toBeNull();
	expect(getClaimPollDelay(100)).toBeNull();
	const total = CLAIM_STATUS_POLL_DELAYS.reduce((sum, delay) => sum + delay, 0);
	expect(total).toBeLessThanOrEqual(120_000);
});

test("rejects invalid attempt indexes", () => {
	expect(getClaimPollDelay(-1)).toBeNull();
	expect(getClaimPollDelay(1.5)).toBeNull();
	expect(getClaimPollDelay(Number.NaN)).toBeNull();
});
