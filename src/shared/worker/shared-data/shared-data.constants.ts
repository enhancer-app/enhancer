import type { SharedData } from "$types/shared/storage/shared-data.types.ts";

export const DEFAULT_SHARED_DATA: SharedData = {
	sharedFollows: {
		twitch: [],
		kick: [],
	},
};
