import type { SidebarChannel } from "$types/shared/components/cross-platform-follows.component.types.ts";

export function matchesFollowsSearch(channel: SidebarChannel, query: string): boolean {
	const needle = query.trim().toLowerCase();
	if (!needle) return true;
	const targets = channel.linked ? Object.values(channel.linked.channels) : [channel];
	return targets.some(
		(target) => target.login.toLowerCase().includes(needle) || target.displayName.toLowerCase().includes(needle),
	);
}

export function filterFollowsBySearch<T extends SidebarChannel>(channels: T[], query: string): T[] {
	return query.trim() ? channels.filter((channel) => matchesFollowsSearch(channel, query)) : channels;
}
