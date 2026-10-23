import type {
	FollowsPlatformFilter,
	FollowsSortOrder,
} from "$types/shared/worker/cross-platform-follows-worker.types.ts";

export type GlobalSettings = {
	crossPlatformFollowsSyncEnabled: boolean;
	crossPlatformFollowsDisplayEnabled: boolean;
	followsHomeEnabled: boolean;
	pinnedStreamersEnabled: boolean;
	followsSort: FollowsSortOrder;
	followsPlatformFilter: FollowsPlatformFilter;
};

export type GlobalSettingsEvents = {
	[K in keyof GlobalSettings as `global:settings:${K & string}`]: (value: GlobalSettings[K]) => void | Promise<void>;
};
