import type { CommonDatabaseData } from "$types/shared/storage/common-database.types.ts";

export const DEFAULT_COMMON_DATABASE: CommonDatabaseData = {
	sharedFollows: {
		twitch: [],
		kick: [],
	},
};
