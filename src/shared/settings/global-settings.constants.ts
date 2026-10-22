import { isEnhancerApiEnvironment } from "$shared/enhancer-environment.ts";
import { isFollowsPlatformFilter } from "$shared/utils/follows-filter.utils.ts";
import { FOLLOWS_SORT_ORDERS } from "$shared/utils/follows-sort.utils.ts";
import type { GlobalSettings } from "$types/shared/settings/global-settings.types.ts";

export const GLOBAL_DEFAULT_SETTINGS: GlobalSettings = {
	crossPlatformFollowsSyncEnabled: false,
	crossPlatformFollowsDisplayEnabled: true,
	followsHomeEnabled: false,
	pinnedStreamersEnabled: true,
	followsSort: "recommended",
	followsPlatformFilter: "all",
	apiEnvironment: "production",
};

export function isGlobalSettingKey(key: PropertyKey): key is keyof GlobalSettings {
	return Object.hasOwn(GLOBAL_DEFAULT_SETTINGS, key);
}

function isValidGlobalSetting(key: keyof GlobalSettings, item: unknown): boolean {
	if (key === "followsSort") return (FOLLOWS_SORT_ORDERS as unknown[]).includes(item);
	if (key === "followsPlatformFilter") return isFollowsPlatformFilter(item);
	if (key === "apiEnvironment") return isEnhancerApiEnvironment(item);
	return typeof item === "boolean";
}

export function sanitizeGlobalSettings(value: unknown): Partial<GlobalSettings> {
	if (typeof value !== "object" || value === null) return {};
	const result: Record<string, unknown> = {};
	for (const [key, item] of Object.entries(value)) {
		if (!isGlobalSettingKey(key)) continue;
		if (isValidGlobalSetting(key, item)) result[key] = item;
	}
	return result as Partial<GlobalSettings>;
}
