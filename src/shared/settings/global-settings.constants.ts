import { FOLLOWS_SORT_ORDERS } from "$shared/utils/follows-sort.utils.ts";
import type { GlobalSettings } from "$types/shared/settings/global-settings.types.ts";

export const GLOBAL_DEFAULT_SETTINGS: GlobalSettings = {
	crossPlatformFollowsSyncEnabled: false,
	crossPlatformFollowsDisplayEnabled: true,
	followsHomeEnabled: false,
	pinnedStreamersEnabled: true,
	followsSort: "recommended",
};

export function isGlobalSettingKey(key: PropertyKey): key is keyof GlobalSettings {
	return Object.hasOwn(GLOBAL_DEFAULT_SETTINGS, key);
}

export function sanitizeGlobalSettings(value: unknown): Partial<GlobalSettings> {
	if (typeof value !== "object" || value === null) return {};
	const result: Record<string, unknown> = {};
	for (const [key, item] of Object.entries(value)) {
		if (!isGlobalSettingKey(key)) continue;
		if (key === "followsSort" ? (FOLLOWS_SORT_ORDERS as unknown[]).includes(item) : typeof item === "boolean")
			result[key] = item;
	}
	return result as Partial<GlobalSettings>;
}
