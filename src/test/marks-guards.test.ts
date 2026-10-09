import { expect, test } from "bun:test";
import {
	isEnhancerAccountSession,
	isOidcErrorResponse,
	isOidcTokenResponse,
} from "$shared/worker/enhancer-account/enhancer-account.guards.ts";
import {
	isChannelMarkResponse,
	isClaimMarkResponse,
	isClaimStatusResponse,
	isEnhancerApiError,
	isMarkClaimsMessageData,
	isPublicMark,
	isViewerMarkState,
} from "$shared/worker/marks/marks.guards.ts";

const mark = {
	id: "mark-1",
	channel: {
		platform: "TWITCH",
		externalChannelId: "123",
		login: "streamer",
		displayName: "Streamer",
		avatarUrl: null,
	},
	title: "Big play",
	reason: "An amazing comeback victory in overtime.",
	code: "AB12CD",
	redeemCommand: "!redeem AB12CD",
	status: "LIVE",
	startedAt: "2026-01-01T00:00:00.000Z",
	endsAt: "2026-01-01T01:00:00.000Z",
	claimCount: 3,
	maxClaims: null,
	graceSeconds: 10,
	badge: { id: "badge-1", name: "Mark badge", description: "Claimed live", sources: { "1x": "https://x/1" } },
};

test("accepts a valid public mark and channel response", () => {
	expect(isPublicMark(mark)).toBe(true);
	expect(isChannelMarkResponse({ mark })).toBe(true);
	expect(isChannelMarkResponse({ mark: null })).toBe(true);
});

test("rejects public marks with bad status, dates or badge", () => {
	expect(isPublicMark({ ...mark, status: "READY" })).toBe(false);
	expect(isPublicMark({ ...mark, endsAt: "yesterday" })).toBe(false);
	expect(isPublicMark({ ...mark, channel: { ...mark.channel, platform: "YOUTUBE" } })).toBe(false);
	expect(isPublicMark({ ...mark, badge: { id: "b" } })).toBe(false);
	expect(isPublicMark(null)).toBe(false);
});

test("validates claim status responses including NONE", () => {
	expect(isClaimStatusResponse({ status: "NONE", claimedAt: null, attemptAt: null })).toBe(true);
	expect(isClaimStatusResponse({ status: "GRANTED", claimedAt: "2026-01-01T00:01:00.000Z", attemptAt: null })).toBe(
		true,
	);
	expect(isClaimStatusResponse({ status: "UNKNOWN", claimedAt: null, attemptAt: null })).toBe(false);
	expect(isClaimStatusResponse({ status: "GRANTED", claimedAt: null })).toBe(false);
});

test("validates viewer state and claim responses", () => {
	expect(isViewerMarkState({ eligible: true, accountLogin: "user", claim: null })).toBe(true);
	expect(
		isViewerMarkState({
			eligible: false,
			accountLogin: null,
			claim: { claimedAt: "2026-01-01T00:01:00.000Z", method: "CHAT" },
		}),
	).toBe(true);
	expect(isViewerMarkState({ eligible: "yes", accountLogin: null, claim: null })).toBe(false);
	expect(
		isClaimMarkResponse({
			result: "GRANTED",
			claimedAt: "2026-01-01T00:01:00.000Z",
			accountLogin: "user",
			mark: { id: "m", title: "t" },
			badge: { id: "b", name: "n", sources: {} },
		}),
	).toBe(true);
	expect(isClaimMarkResponse({ result: "GRANTED", claimedAt: "bad-date", mark: {}, badge: {} })).toBe(false);
	expect(isEnhancerApiError({ error: { code: "MARK_NOT_LIVE", message: "ended" } })).toBe(true);
	expect(isEnhancerApiError({ error: "MARK_NOT_LIVE" })).toBe(false);
});

test("validates OIDC token and error responses", () => {
	expect(isOidcTokenResponse({ access_token: "a", expires_in: 60, token_type: "Bearer" })).toBe(true);
	expect(
		isOidcTokenResponse({
			access_token: "a",
			refresh_token: "r",
			id_token: "i",
			expires_in: 60,
			refresh_expires_in: 300,
			token_type: "Bearer",
		}),
	).toBe(true);
	expect(isOidcTokenResponse({ access_token: "a", expires_in: "60", token_type: "Bearer" })).toBe(false);
	expect(isOidcErrorResponse({ error: "invalid_grant" })).toBe(true);
	expect(isOidcErrorResponse({})).toBe(false);
});

test("validates stored account sessions", () => {
	const session = {
		accessToken: "a",
		refreshToken: "r",
		idToken: null,
		expiresAt: 123,
		refreshExpiresAt: null,
		profile: { subject: "s", displayName: "d", username: "u" },
	};
	expect(isEnhancerAccountSession(session)).toBe(true);
	expect(isEnhancerAccountSession({ ...session, accessToken: 1 })).toBe(false);
	expect(isEnhancerAccountSession({ ...session, profile: null })).toBe(false);
	expect(isEnhancerAccountSession(null)).toBe(false);
});

test("validates mark.claims message data", () => {
	expect(isMarkClaimsMessageData({ markId: "m1", claimCount: 17, maxClaims: 100 })).toBe(true);
	expect(isMarkClaimsMessageData({ markId: "m1", claimCount: 3, maxClaims: null })).toBe(true);
	expect(isMarkClaimsMessageData({ markId: "m1", claimCount: -1, maxClaims: null })).toBe(false);
	expect(isMarkClaimsMessageData({ markId: 1, claimCount: 1, maxClaims: null })).toBe(false);
});
