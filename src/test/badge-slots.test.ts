import { expect, test } from "bun:test";
import { buildSlotRequest, cooldownMinutesLeft, groupBadgeSlots } from "$shared/enhancer-account/badge-slots.ts";
import { isViewerBadges, isViewerSummary } from "$shared/worker/enhancer-account/enhancer-account.guards.ts";
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
