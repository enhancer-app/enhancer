export type PlatformFollowData = {
	follows: string[];
	lastSyncedAt: number;
};

export type SharedData = {
	sharedFollows: {
		twitch: PlatformFollowData;
		kick: PlatformFollowData;
	};
};
