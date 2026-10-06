import type {
	EnhancerViewerBadge,
	EnhancerViewerBadges,
	SaveBadgeSlotRequest,
} from "$types/apis/enhancer-account.apis.ts";
import type { BadgeSlotGroup } from "$types/shared/components/enhancer-account.component.types.ts";

export function groupBadgeSlots(badges: EnhancerViewerBadges): BadgeSlotGroup[] {
	const groups = new Map<string, BadgeSlotGroup>();
	for (const badge of [...badges.global, ...badges.channels]) {
		const key = `${badge.accountId}:${badge.scope}:${badge.channelId ?? ""}`;
		let group = groups.get(key);
		if (!group) {
			group = {
				key,
				scope: badge.scope,
				accountId: badge.accountId,
				accountPlatform: badge.accountPlatform,
				accountLogin: badge.accountLogin,
				channelId: badge.channelId,
				channelLogin: badge.channelLogin,
				channelAvatarUrl: badge.channelAvatarUrl,
				badges: [],
				selectedAssignmentId: null,
				cooldownUntil: null,
			};
			groups.set(key, group);
		}
		group.badges.push(badge);
		if (!badge.forced && badge.visible) group.selectedAssignmentId = badge.assignmentId;
		if (badge.cooldownUntil) group.cooldownUntil = badge.cooldownUntil;
	}
	return [...groups.values()].sort(
		(a, b) =>
			(a.scope === b.scope ? 0 : a.scope === "GLOBAL" ? -1 : 1) ||
			a.accountPlatform.localeCompare(b.accountPlatform) ||
			(a.channelLogin ?? "").localeCompare(b.channelLogin ?? ""),
	);
}

export function buildSlotRequest(group: BadgeSlotGroup, selectedAssignmentId: string | null): SaveBadgeSlotRequest {
	const forcedVisible = group.badges
		.filter((badge: EnhancerViewerBadge) => badge.forced && !badge.hidden)
		.map((badge) => badge.assignmentId);
	return {
		scope: group.scope,
		accountId: group.accountId,
		...(group.scope === "CHANNEL" && group.channelId ? { channelId: group.channelId } : {}),
		visibleAssignmentIds: selectedAssignmentId ? [...forcedVisible, selectedAssignmentId] : forcedVisible,
	};
}

export function cooldownMinutesLeft(cooldownUntil: string | null, now = Date.now()): number {
	if (!cooldownUntil) return 0;
	const remaining = Date.parse(cooldownUntil) - now;
	if (Number.isNaN(remaining) || remaining <= 0) return 0;
	return Math.ceil(remaining / 60_000);
}
