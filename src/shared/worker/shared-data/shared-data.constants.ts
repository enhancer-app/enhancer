import type { PlatformFollowData } from "$types/shared/storage/shared-data.types.ts";

const EMPTY_FOLLOWS: PlatformFollowData = {
	follows: [],
	lastSyncedAt: 0,
};

export const DEFAULT_SHARED_DATA = {
	crossPlatformFollows: {
		twitch: { ...EMPTY_FOLLOWS },
		kick: { ...EMPTY_FOLLOWS },
	},
};
