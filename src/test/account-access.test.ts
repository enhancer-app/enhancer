import { expect, test } from "bun:test";
import { buildAccountCard } from "$shared/enhancer-account/account-card.ts";
import { isActionAllowedFrom } from "$shared/worker/enhancer-account/account-access.ts";
import type { EnhancerViewerBadge } from "$types/apis/enhancer-account.apis.ts";

const EXTENSION = "chrome-extension://abc/";

test("account actions are refused from Twitch and Kick pages and accepted from extension pages", () => {
	for (const action of ["loginEnhancerAccount", "saveEnhancerChatStyle", "getEnhancerBilling"] as const) {
		expect(isActionAllowedFrom(action, "https://www.twitch.tv/xqc", EXTENSION)).toBe(false);
		expect(isActionAllowedFrom(action, undefined, EXTENSION)).toBe(false);
		expect(isActionAllowedFrom(action, "chrome-extension://other/account.html", EXTENSION)).toBe(false);
		expect(isActionAllowedFrom(action, `${EXTENSION}account.html?platform=kick`, EXTENSION)).toBe(true);
	}
	expect(isActionAllowedFrom("getEnhancerAccountCard", "https://kick.com/xqc", EXTENSION)).toBe(true);
	expect(isActionAllowedFrom("updateSettings", "https://kick.com/xqc", EXTENSION)).toBe(true);
	expect(isActionAllowedFrom("loginEnhancerAccount", "", "")).toBe(false);
});

const badge = (overrides: Partial<EnhancerViewerBadge>): EnhancerViewerBadge => ({
	assignmentId: "a1",
	accountId: "acc-1",
	accountPlatform: "TWITCH",
	accountLogin: "viewer",
	badgeId: "b1",
	name: "Supporter",
	sources: { "1x": "https://cdn/1x.png", "2x": "https://cdn/2x.png" },
	scope: "GLOBAL",
	channelId: null,
	channelLogin: null,
	channelDisplayName: null,
	channelAvatarUrl: null,
	hidden: false,
	forced: false,
	visible: true,
	createdAt: "2026-01-01T00:00:00.000Z",
	cooldownUntil: null,
	...overrides,
});

test("the account card exposes only the name, avatar and the badge shown on this platform", () => {
	const card = buildAccountCard(
		{ loggedIn: true, environment: "production", displayName: "Fallback", username: "fallback" },
		{
			user: {
				id: "u1",
				username: "viewer",
				displayName: "Viewer",
				primaryProvider: "twitch",
				avatarUrl: "https://cdn/avatar.png",
				createdAt: "2026-01-01T00:00:00.000Z",
			},
			identities: [],
		},
		{ global: [badge({}), badge({ assignmentId: "k", accountPlatform: "KICK", name: "Kick badge" })], channels: [] },
		"twitch",
	);
	expect(card).toEqual({
		loggedIn: true,
		displayName: "Viewer",
		avatarUrl: "https://cdn/avatar.png",
		badgesLoaded: true,
		badgeName: "Supporter",
		badgeImageUrl: card.badgeImageUrl,
	});
	expect(card.badgeImageUrl).toStartWith("https://cdn/");
});

test("the account card falls back to the session name and hides everything when logged out", () => {
	const account = { loggedIn: true, environment: "test" as const, username: "s1" };
	expect(buildAccountCard(account, null, null, "kick")).toMatchObject({ displayName: "s1", badgesLoaded: false });
	expect(buildAccountCard({ loggedIn: false, environment: "production" }, null, null, "twitch")).toEqual({
		loggedIn: false,
		displayName: null,
		avatarUrl: null,
		badgesLoaded: false,
		badgeName: null,
		badgeImageUrl: null,
	});
});
