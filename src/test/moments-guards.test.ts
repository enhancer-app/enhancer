import { expect, test } from "bun:test";
import {
	isEnhancerAccountSession,
	isOidcErrorResponse,
	isOidcTokenResponse,
} from "$shared/worker/enhancer-account/enhancer-account.guards.ts";
import {
	isChannelMomentResponse,
	isClaimMomentResponse,
	isClaimStatusResponse,
	isEnhancerApiError,
	isPublicMoment,
	isViewerMomentState,
} from "$shared/worker/moments/moments.guards.ts";

const moment = {
	id: "moment-1",
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
	badge: { id: "badge-1", name: "Moment badge", description: "Claimed live", sources: { "1x": "https://x/1" } },
};

test("accepts a valid public moment and channel response", () => {
	expect(isPublicMoment(moment)).toBe(true);
	expect(isChannelMomentResponse({ moment })).toBe(true);
	expect(isChannelMomentResponse({ moment: null })).toBe(true);
});

test("rejects public moments with bad status, dates or badge", () => {
	expect(isPublicMoment({ ...moment, status: "READY" })).toBe(false);
	expect(isPublicMoment({ ...moment, endsAt: "yesterday" })).toBe(false);
	expect(isPublicMoment({ ...moment, channel: { ...moment.channel, platform: "YOUTUBE" } })).toBe(false);
	expect(isPublicMoment({ ...moment, badge: { id: "b" } })).toBe(false);
	expect(isPublicMoment(null)).toBe(false);
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
	expect(isViewerMomentState({ eligible: true, accountLogin: "user", claim: null })).toBe(true);
	expect(
		isViewerMomentState({
			eligible: false,
			accountLogin: null,
			claim: { claimedAt: "2026-01-01T00:01:00.000Z", method: "CHAT" },
		}),
	).toBe(true);
	expect(isViewerMomentState({ eligible: "yes", accountLogin: null, claim: null })).toBe(false);
	expect(
		isClaimMomentResponse({
			result: "GRANTED",
			claimedAt: "2026-01-01T00:01:00.000Z",
			accountLogin: "user",
			moment: { id: "m", title: "t" },
			badge: { id: "b", name: "n", sources: {} },
		}),
	).toBe(true);
	expect(isClaimMomentResponse({ result: "GRANTED", claimedAt: "bad-date", moment: {}, badge: {} })).toBe(false);
	expect(isEnhancerApiError({ error: { code: "MOMENT_NOT_LIVE", message: "ended" } })).toBe(true);
	expect(isEnhancerApiError({ error: "MOMENT_NOT_LIVE" })).toBe(false);
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
