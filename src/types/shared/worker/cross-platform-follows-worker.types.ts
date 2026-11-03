import type { PlatformType } from "$types/shared/platform.types.ts";

export type FollowedChannel = {
	login: string;
	displayName: string;
	avatarUrl: string | null;
};

export type CrossPlatformFollowsProblem = "session-missing" | "request-failed";

export type CrossPlatformFollowsRecord = {
	platform: PlatformType;
	channels: FollowedChannel[];
	syncedAt: number;
	statusCheckedAt: number | null;
	statusProblem: CrossPlatformFollowsProblem | null;
	statusProblemSince?: number | null;
};

export type ChannelStatusRecord = {
	id: string;
	platform: PlatformType;
	login: string;
	displayName: string | null;
	avatarUrl: string | null;
	live: boolean;
	viewers: number;
	title: string | null;
	category: string | null;
	thumbnailUrl: string | null;
	startedAt: number | null;
	lastLiveAt: number | null;
	checkedAt: number;
};

export type CrossPlatformChannel = {
	login: string;
	displayName: string;
	avatarUrl: string | null;
	live: boolean;
	viewers: number;
	title: string | null;
	category: string | null;
	thumbnailUrl: string | null;
	startedAt: number | null;
	lastLiveAt: number | null;
	checked: boolean;
	pinned: boolean;
	watchtime: number;
	watchedAt: number | null;
};

export type CrossPlatformFollowsSnapshot = {
	platform: PlatformType;
	synced: boolean;
	syncedAt: number | null;
	checkedAt: number | null;
	problem: CrossPlatformFollowsProblem | null;
	problemSince: number | null;
	refreshing: boolean;
	channels: CrossPlatformChannel[];
};

export type FollowsStatusState = "fresh" | "updating" | "failed";

export type ChannelStatusUpdate = Omit<ChannelStatusRecord, "id" | "platform" | "lastLiveAt" | "checkedAt"> & {
	lastLiveAt?: number | null;
};

export type ChannelStatusFetchResult =
	| { ok: true; statuses: ChannelStatusUpdate[]; partial: boolean }
	| { ok: false; problem: CrossPlatformFollowsProblem };

export interface SyncFollowsPayload {
	platform: PlatformType;
	channels: FollowedChannel[];
}

export interface UpdateFollowPayload {
	platform: PlatformType;
	channel: FollowedChannel;
	followed: boolean;
}

export interface GetStreamPlaybackUrlPayload {
	platform: PlatformType;
	login: string;
}

export type FollowsSortOrder = "recommended" | "viewers-desc" | "viewers-asc";

export type FollowsPlatformFilter = PlatformType | "all";

export interface ClearFollowsPayload {
	platform: PlatformType;
}

export interface SyncKickSessionPayload {
	token: string | null;
}

export interface GetFollowsStatusPayload {
	platform: PlatformType;
	refresh?: boolean;
}
