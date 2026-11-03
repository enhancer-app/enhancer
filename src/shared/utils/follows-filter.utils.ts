import type { PlatformType } from "$types/shared/platform.types.ts";
import type { FollowsPlatformFilter } from "$types/shared/worker/cross-platform-follows-worker.types.ts";

export const FOLLOWS_PLATFORM_FILTERS: FollowsPlatformFilter[] = ["all", "twitch", "kick"];

export function isFollowsPlatformFilter(value: unknown): value is FollowsPlatformFilter {
	return FOLLOWS_PLATFORM_FILTERS.includes(value as FollowsPlatformFilter);
}

export function filterFollowsByPlatform<T extends { platform: PlatformType }>(
	channels: T[],
	filter: FollowsPlatformFilter,
): T[] {
	return filter === "all" ? channels : channels.filter((channel) => channel.platform === filter);
}
