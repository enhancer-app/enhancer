import type {
	EnhancerViewerBadge,
	EnhancerViewerBadges,
	SaveBadgeSlotRequest,
} from "$types/apis/enhancer-account.apis.ts";
import type { BadgeSlotGroup } from "$types/shared/components/enhancer-account.component.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";

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
				channelDisplayName: badge.channelDisplayName ?? null,
				channelAvatarUrl: badge.channelAvatarUrl,
				badges: [],
				selectedAssignmentId: null,
				visibleAssignmentIds: [],
				multi: false,
				cooldownUntil: null,
			};
			groups.set(key, group);
		}
		group.badges.push(badge);
		if (!badge.forced && badge.visible) group.selectedAssignmentId = badge.assignmentId;
		if (badge.visible) group.visibleAssignmentIds.push(badge.assignmentId);
		if (badge.forced) group.multi = true;
		if (badge.cooldownUntil) group.cooldownUntil = badge.cooldownUntil;
	}
	return [...groups.values()].sort(
		(a, b) =>
			(a.scope === b.scope ? 0 : a.scope === "GLOBAL" ? -1 : 1) ||
			a.accountPlatform.localeCompare(b.accountPlatform) ||
			(a.channelDisplayName ?? a.channelLogin ?? "").localeCompare(b.channelDisplayName ?? b.channelLogin ?? ""),
	);
}

export function buildSlotRequest(group: BadgeSlotGroup, visibleAssignmentIds: Iterable<string>): SaveBadgeSlotRequest {
	const visible = new Set(visibleAssignmentIds);
	return {
		scope: group.scope,
		accountId: group.accountId,
		...(group.scope === "CHANNEL" && group.channelId ? { channelId: group.channelId } : {}),
		visibleAssignmentIds: group.badges.map((badge) => badge.assignmentId).filter((id) => visible.has(id)),
	};
}

export function pickSlotBadge(group: BadgeSlotGroup, current: ReadonlySet<string>, assignmentId: string): Set<string> {
	const forced = new Set(group.badges.filter((badge) => badge.forced).map((badge) => badge.assignmentId));
	const next = new Set([...current].filter((id) => forced.has(id)));
	next.add(assignmentId);
	return next;
}

export function toggleSlotBadge(
	group: BadgeSlotGroup,
	current: ReadonlySet<string>,
	assignmentId: string,
): Set<string> {
	if (current.has(assignmentId)) {
		const next = new Set(current);
		next.delete(assignmentId);
		return next;
	}
	const badge = group.badges.find((item) => item.assignmentId === assignmentId);
	return badge?.forced ? new Set([...current, assignmentId]) : pickSlotBadge(group, current, assignmentId);
}

export function cooldownMinutesLeft(cooldownUntil: string | null, now = Date.now()): number {
	if (!cooldownUntil) return 0;
	const remaining = Date.parse(cooldownUntil) - now;
	if (Number.isNaN(remaining) || remaining <= 0) return 0;
	return Math.ceil(remaining / 60_000);
}

export function filterSlotGroups(groups: BadgeSlotGroup[], query: string): BadgeSlotGroup[] {
	const needle = query.trim().toLowerCase();
	if (!needle) return groups;
	return groups.filter(
		(group) =>
			group.scope === "CHANNEL" &&
			[group.channelDisplayName, group.channelLogin].some((name) => name?.toLowerCase().includes(needle)),
	);
}

export function filterPlatformBadges(badges: EnhancerViewerBadges, platform: PlatformType): EnhancerViewerBadges {
	return {
		global: badges.global.filter((badge) => badge.accountPlatform.toLowerCase() === platform),
		channels: badges.channels.filter((badge) => badge.accountPlatform.toLowerCase() === platform),
	};
}

export function findShownGlobalBadge(groups: BadgeSlotGroup[]): EnhancerViewerBadge | null {
	const global = groups.find((group) => group.scope === "GLOBAL");
	const shownId = global?.selectedAssignmentId ?? global?.visibleAssignmentIds[0];
	if (!global || !shownId) return null;
	return global.badges.find((badge) => badge.assignmentId === shownId) ?? null;
}

export function filterAccountBadges(badges: EnhancerViewerBadges, accountId: string): EnhancerViewerBadges {
	return {
		global: badges.global.filter((badge) => badge.accountId === accountId),
		channels: badges.channels.filter((badge) => badge.accountId === accountId),
	};
}

export function sortChatAccounts<T extends { platform: "TWITCH" | "KICK" }>(
	accounts: T[],
	platform: PlatformType,
): T[] {
	const current = platform.toUpperCase();
	return [...accounts].sort((a, b) => Number(b.platform === current) - Number(a.platform === current));
}
