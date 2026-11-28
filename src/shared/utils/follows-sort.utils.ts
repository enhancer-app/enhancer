import type { FollowsSortOrder } from "$types/shared/worker/cross-platform-follows-worker.types.ts";

export const FOLLOWS_SORT_LABELS: Record<FollowsSortOrder, string> = {
	recommended: "Recommended",
	"viewers-desc": "Most viewers",
	"viewers-asc": "Fewest viewers",
};

export const FOLLOWS_SORT_ORDERS = Object.keys(FOLLOWS_SORT_LABELS) as FollowsSortOrder[];

export function parseFollowsSort(value: unknown): FollowsSortOrder {
	return FOLLOWS_SORT_ORDERS.includes(value as FollowsSortOrder) ? (value as FollowsSortOrder) : "recommended";
}
