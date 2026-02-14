import type { PlatformType } from "$types/shared/platform.types.ts";

export interface SharedFollower {
	platform: PlatformType;
	username: string;
	channelId: string;
	profilePictureUrl?: string;
}

export interface StreamStatusResult {
	displayName: string | null;
	isLive: boolean;
	gameName: string | null;
	viewerCount: number;
	title: string | null;
	profilePictureUrl: string | null;
	startedAt: string | null;
}

export interface LiveStreamerEntry {
	channelId: string;
	platform: PlatformType;
	username: string;
	displayName: string | null;
	isLive: boolean;
	gameName: string | null;
	title: string | null;
	viewerCount: number;
	profilePictureUrl: string | null;
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
