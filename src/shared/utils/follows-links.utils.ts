import type { SidebarChannel } from "$types/shared/components/cross-platform-follows.component.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { ChannelLink, ChannelLinkRecord } from "$types/shared/worker/channel-links-worker.types.ts";
import type { CrossPlatformChannel } from "$types/shared/worker/cross-platform-follows-worker.types.ts";

export function getChannelLinkId(twitch: string, kick: string): string {
	return `${twitch}:${kick}`;
}

export function getConflictingLinkIds(links: ChannelLinkRecord[], record: ChannelLinkRecord): string[] {
	return links
		.filter((link) => link.id !== record.id && (link.twitch === record.twitch || link.kick === record.kick))
		.map((link) => link.id);
}

export function pickLinkedPlatform(
	channels: Record<PlatformType, CrossPlatformChannel>,
	primary: PlatformType,
): PlatformType {
	const { twitch, kick } = channels;
	if (twitch.live !== kick.live) return twitch.live ? "twitch" : "kick";
	return primary;
}

function latest(a: number | null, b: number | null): number | null {
	if (a === null) return b;
	return b === null ? a : Math.max(a, b);
}

export function mergeLinkedChannels(channels: SidebarChannel[], links: ChannelLink[]): SidebarChannel[] {
	const byKey = new Map(channels.map((channel) => [`${channel.platform}:${channel.login}`, channel]));
	const merged = new Map<string, SidebarChannel>();
	const consumed = new Set<string>();

	for (const link of links) {
		const twitchKey = `twitch:${link.twitch}`;
		const kickKey = `kick:${link.kick}`;
		const twitch = byKey.get(twitchKey);
		const kick = byKey.get(kickKey);
		if (!twitch || !kick || consumed.has(twitchKey) || consumed.has(kickKey)) continue;
		consumed.add(twitchKey).add(kickKey);
		const pair = { twitch, kick };
		merged.set(twitchKey, {
			...pair[pickLinkedPlatform(pair, link.primary)],
			pinned: twitch.pinned || kick.pinned,
			watchtime: twitch.watchtime + kick.watchtime,
			watchedAt: latest(twitch.watchedAt, kick.watchedAt),
			linked: { channels: { twitch, kick }, primary: link.primary },
		});
	}

	const result: SidebarChannel[] = [];
	for (const channel of channels) {
		const key = `${channel.platform}:${channel.login}`;
		const entry = merged.get(key);
		if (entry) result.push(entry);
		else if (!consumed.has(key)) result.push(channel);
	}
	return result;
}

export function searchLinkCandidates(
	channels: SidebarChannel[],
	platform: PlatformType,
	query: string,
): SidebarChannel[] {
	const needle = query.trim().toLowerCase();
	const rank = (channel: SidebarChannel) => {
		const names = [channel.login, channel.displayName.toLowerCase()];
		if (names.includes(needle)) return 0;
		return names.some((name) => name.startsWith(needle)) ? 1 : 2;
	};
	return channels
		.filter(
			(channel) =>
				channel.platform === platform &&
				!channel.linked &&
				(channel.login.includes(needle) || channel.displayName.toLowerCase().includes(needle)),
		)
		.sort((a, b) => rank(a) - rank(b) || Number(b.live) - Number(a.live) || a.displayName.localeCompare(b.displayName));
}

export function matchesFollowsPlatform(channel: SidebarChannel, platform: PlatformType): boolean {
	return channel.platform === platform;
}

export function getFollowEntryKey(channel: SidebarChannel): string {
	if (!channel.linked) return `${channel.platform}:${channel.login}`;
	const { twitch, kick } = channel.linked.channels;
	return `linked:${twitch.login}:${kick.login}`;
}
