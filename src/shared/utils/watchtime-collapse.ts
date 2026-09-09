import type { PlatformType } from "$types/shared/platform.types.ts";

const STORAGE_KEY = "enhancer-watchtime-collapse";

const getState = (): Record<string, boolean> => {
	try {
		const rawState = localStorage.getItem(STORAGE_KEY);
		return rawState ? (JSON.parse(rawState) as Record<string, boolean>) : {};
	} catch {
		return {};
	}
};

export const getWatchtimeCollapsed = (platform: PlatformType, username: string): boolean => {
	return getState()[`${platform}:${username}`] ?? false;
};

export const setWatchtimeCollapsed = (platform: PlatformType, username: string, collapsed: boolean): void => {
	try {
		const state = getState();
		state[`${platform}:${username}`] = collapsed;
		localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	} catch {}
};
