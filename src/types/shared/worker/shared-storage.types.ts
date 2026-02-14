import type { PlatformType } from "$types/shared/platform.types.ts";

export interface SharedFollower {
	platform: PlatformType;
	username: string;
	channelId: string;
	profilePictureUrl?: string;
}

export interface StreamStatusResult {
	isLive: boolean;
	gameName: string | null;
	viewerCount: number;
	startedAt: string | null;
}

export interface LiveStreamerEntry {
	channelId: string;
	platform: PlatformType;
	username: string;
	isLive: boolean;
	gameName: string | null;
	viewerCount: number;
	thumbnailUrl: string | null;
	startedAt: string | null;
	lastChecked: number;
	lastLiveAt: number | null;
}

export interface SharedStorageKeys {
	"sharedFollowers.twitch": SharedFollower[];
	"sharedFollowers.kick": SharedFollower[];
	"sharedFollowers.liveCache": LiveStreamerEntry[];
}

export type SharedStorageKey = keyof SharedStorageKeys;

export interface GetSharedStoragePayload {
	key: SharedStorageKey;
}

export interface GetSharedStorageResponse {
	value: SharedStorageKeys[SharedStorageKey] | null;
}

export interface SetSharedStoragePayload {
	key: SharedStorageKey;
	value: SharedStorageKeys[SharedStorageKey];
}

export interface SetSharedStorageResponse {
	success: true;
}

export type GetLiveStreamersCachePayload = Record<string, never>;

export interface GetLiveStreamersCacheResponse {
	streamers: LiveStreamerEntry[];
}
