import type { SidebarChannel } from "$types/shared/components/cross-platform-follows.component.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";

const MULTIPLIERS: Record<string, number> = { k: 1_000, tys: 1_000, m: 1_000_000, mln: 1_000_000 };

export function parseViewerCount(text: string | null | undefined): number {
	const match = text?.match(/(\d[\d\s.,]*)(tys|mln|k|m)?(?![a-ząćęłńóśźż])/i);
	if (!match) return 0;
	const multiplier = match[2] ? MULTIPLIERS[match[2].toLowerCase()] : 1;
	if (multiplier === 1) return Number(match[1].replace(/\D/g, "")) || 0;
	const value = Number.parseFloat(match[1].replace(/\s/g, "").replace(",", "."));
	return Number.isFinite(value) ? Math.round(value * multiplier) : 0;
}

export function getLoginFromHref(href: string | null): string | null {
	const login = href?.match(/^(?:https?:\/\/[^/]+)?\/([\w-]+)\/?(?:[?#].*)?$/)?.[1];
	return login ? login.toLowerCase() : null;
}

export function createSidebarChannel(
	platform: PlatformType,
	channel: Pick<SidebarChannel, "login"> & Partial<SidebarChannel>,
): SidebarChannel {
	return {
		displayName: channel.login,
		avatarUrl: null,
		live: false,
		viewers: 0,
		title: null,
		category: null,
		thumbnailUrl: null,
		startedAt: null,
		lastLiveAt: null,
		checked: true,
		pinned: false,
		watchtime: 0,
		watchedAt: null,
		...channel,
		platform,
	};
}
