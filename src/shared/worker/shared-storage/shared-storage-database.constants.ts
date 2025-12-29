import type { SharedStorageData } from "$types/shared/storage/shared-storage.types.ts";

export const DEFAULT_SHARED_STORAGE: SharedStorageData = {
	sharedFollows: {
		twitch: [],
		kick: [],
	},
};
