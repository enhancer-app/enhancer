import { expect, test } from "bun:test";
import {
	buildSlotRequest,
	cooldownMinutesLeft,
	filterAccountBadges,
	filterPlatformBadges,
	filterSlotGroups,
	findShownGlobalBadge,
	groupBadgeSlots,
	sortChatAccounts,
} from "$shared/enhancer-account/badge-slots.ts";
import {
	isViewerBadges,
	isViewerBilling,
	isViewerSummary,
} from "$shared/worker/enhancer-account/enhancer-account.guards.ts";
import type { EnhancerViewerBadge } from "$types/apis/enhancer-account.apis.ts";

const badge = (overrides: Partial<EnhancerViewerBadge>): EnhancerViewerBadge => ({
	assignmentId: "a1",
	accountId: "acc-1",
	accountPlatform: "TWITCH",
	accountLogin: "viewer",
	badgeId: "b1",
	name: "Badge",
	sources: { "1x": "https://x/1" },
	scope: "GLOBAL",
	channelId: null,
	channelLogin: null,
	channelDisplayName: null,
	channelAvatarUrl: null,
	hidden: false,
	forced: false,
	visible: false,
	createdAt: "2026-01-01T00:00:00.000Z",
	cooldownUntil: null,
	...overrides,
});

test("groups badges by account, scope and channel with the visible regular badge selected", () => {
	const groups = groupBadgeSlots({
		global: [badge({ assignmentId: "g1", visible: true }), badge({ assignmentId: "g2" })],
		channels: [
			badge({ assignmentId: "c1", scope: "CHANNEL", channelId: "ch-1", channelLogin: "streamer" }),
			badge({
				assignmentId: "c2",
				scope: "CHANNEL",
				channelId: "ch-1",
				channelLogin: "streamer",
				forced: true,
				visible: true,
			}),
		],
	});
	expect(groups.map((group) => group.key)).toEqual(["acc-1:GLOBAL:", "acc-1:CHANNEL:ch-1"]);
	expect(groups[0]?.selectedAssignmentId).toBe("g1");
	expect(groups[1]?.selectedAssignmentId).toBeNull();
});

test("slot request keeps forced badges visible and adds the chosen one", () => {
	const [group] = groupBadgeSlots({
		global: [],
		channels: [
			badge({ assignmentId: "c1", scope: "CHANNEL", channelId: "ch-1" }),
			badge({ assignmentId: "c2", scope: "CHANNEL", channelId: "ch-1", forced: true, visible: true }),
			badge({ assignmentId: "c3", scope: "CHANNEL", channelId: "ch-1", forced: true, hidden: true }),
		],
	});
	expect(group && buildSlotRequest(group, "c1")).toEqual({
		scope: "CHANNEL",
		accountId: "acc-1",
		channelId: "ch-1",
		visibleAssignmentIds: ["c2", "c1"],
	});
	expect(group && buildSlotRequest(group, null).visibleAssignmentIds).toEqual(["c2"]);
});

test("cooldown minutes round up and ignore past dates", () => {
	const now = Date.parse("2026-01-01T00:00:00.000Z");
	expect(cooldownMinutesLeft("2026-01-01T00:01:30.000Z", now)).toBe(2);
	expect(cooldownMinutesLeft("2025-12-31T23:59:00.000Z", now)).toBe(0);
	expect(cooldownMinutesLeft(null, now)).toBe(0);
});

test("validates viewer summary and badge list payloads", () => {
	expect(
		isViewerSummary({
			user: {
				id: "u1",
				username: "viewer",
				displayName: "Viewer",
				primaryProvider: "TWITCH",
				avatarUrl: null,
				createdAt: "2026-01-01T00:00:00.000Z",
			},
			identities: [{ provider: "TWITCH", providerUsername: "viewer", providerDisplayName: null, avatarUrl: null }],
		}),
	).toBe(true);
	expect(isViewerSummary({ user: { id: 1 }, identities: [] })).toBe(false);
	expect(isViewerBadges({ global: [badge({})], channels: [] })).toBe(true);
	expect(isViewerBadges({ global: [{ assignmentId: "x" }], channels: [] })).toBe(false);
});

test("channel search matches display names and logins and hides the global slot", () => {
	const groups = groupBadgeSlots({
		global: [badge({ assignmentId: "g1" })],
		channels: [
			badge({
				assignmentId: "c1",
				scope: "CHANNEL",
				channelId: "ch-1",
				channelLogin: "summit1g",
				channelDisplayName: "Summit1G",
			}),
			badge({
				assignmentId: "c2",
				scope: "CHANNEL",
				channelId: "ch-2",
				channelLogin: "pokimane",
				channelDisplayName: "Pokimane",
			}),
		],
	});
	expect(filterSlotGroups(groups, "").length).toBe(3);
	expect(filterSlotGroups(groups, "  SUM ").map((group) => group.channelLogin)).toEqual(["summit1g"]);
	expect(filterSlotGroups(groups, "poki").map((group) => group.channelLogin)).toEqual(["pokimane"]);
	expect(filterSlotGroups(groups, "nope")).toEqual([]);
});

test("keeps only the badges of the current platform", () => {
	const filtered = filterPlatformBadges(
		{
			global: [badge({ assignmentId: "t" }), badge({ assignmentId: "k", accountPlatform: "KICK" })],
			channels: [badge({ assignmentId: "kc", accountPlatform: "KICK", scope: "CHANNEL", channelId: "ch" })],
		},
		"kick",
	);
	expect(filtered.global.map((item) => item.assignmentId)).toEqual(["k"]);
	expect(filtered.channels.map((item) => item.assignmentId)).toEqual(["kc"]);
});

test("finds the global badge shown in chat and ignores channel and admin badges", () => {
	const shown = findShownGlobalBadge(
		groupBadgeSlots({
			global: [
				badge({ assignmentId: "forced", forced: true, visible: true }),
				badge({ assignmentId: "g2", visible: true, name: "Early" }),
			],
			channels: [badge({ assignmentId: "c1", scope: "CHANNEL", channelId: "ch", visible: true })],
		}),
	);
	expect(shown?.name).toBe("Early");
	expect(findShownGlobalBadge(groupBadgeSlots({ global: [badge({})], channels: [] }))).toBeNull();
});

test("keeps only the badges of the selected linked account", () => {
	const filtered = filterAccountBadges(
		{
			global: [badge({ assignmentId: "mine" }), badge({ assignmentId: "other", accountId: "acc-2" })],
			channels: [badge({ assignmentId: "c", accountId: "acc-2", scope: "CHANNEL", channelId: "ch" })],
		},
		"acc-2",
	);
	expect(filtered.global.map((item) => item.assignmentId)).toEqual(["other"]);
	expect(filtered.channels.map((item) => item.assignmentId)).toEqual(["c"]);
});

test("puts accounts from the current platform first and keeps the rest in order", () => {
	const accounts = [
		{ id: "t1", platform: "TWITCH" as const },
		{ id: "k1", platform: "KICK" as const },
		{ id: "t2", platform: "TWITCH" as const },
		{ id: "k2", platform: "KICK" as const },
	];
	expect(sortChatAccounts(accounts, "kick").map((item) => item.id)).toEqual(["k1", "k2", "t1", "t2"]);
});

const billingAccount = {
	accountId: "acc-1",
	platform: "TWITCH",
	login: "viewer",
	displayName: "Viewer",
	hasGlow: false,
	customFont: null,
	styleCooldownUntil: null,
	nickname: null,
	nicknameCooldownUntil: null,
	nicknamePending: null,
	nicknameRejected: null,
};
const billingStyle = {
	glowAllowed: true,
	fontAllowed: true,
	nicknameAllowed: false,
	nicknameCooldownDays: 30,
	fonts: ["Bungee"],
};

test("accepts the chat style part of the billing response and rejects broken accounts", () => {
	expect(isViewerBilling({ enabled: true, style: billingStyle, accounts: [billingAccount], tiers: [] })).toBe(true);
	expect(
		isViewerBilling({
			enabled: true,
			style: billingStyle,
			accounts: [{ ...billingAccount, nicknameRejected: { nickname: "x", reason: null } }],
		}),
	).toBe(true);
	expect(
		isViewerBilling({ enabled: true, style: billingStyle, accounts: [{ ...billingAccount, platform: "YOUTUBE" }] }),
	).toBe(false);
	expect(isViewerBilling({ enabled: true, style: { ...billingStyle, fonts: [1] }, accounts: [] })).toBe(false);
});
