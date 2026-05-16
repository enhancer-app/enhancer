export type PlatformFollowData = {
	follows: string[];
	lastSyncedAt: number;
};

export type SharedData = {
	crossPlatformFollows: {
		twitch: PlatformFollowData;
		kick: PlatformFollowData;
	};
};
