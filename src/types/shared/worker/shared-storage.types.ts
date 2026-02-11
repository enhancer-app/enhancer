import type { PlatformType } from "$types/shared/platform.types.ts";

export interface SharedFollower {
	platform: PlatformType;
	username: string;
	channelId: string;
	profilePictureUrl?: string;
}

export interface LiveStreamerEntry {
	channelId: string;
	platform: PlatformType;
	username: string;
	isLive: boolean;
	lastChecked: number;
}

export interface SharedStorageKeys {
	"sharedFollowers.twitch": SharedFollower[];
	"sharedFollowers.kick": SharedFollower[];
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
