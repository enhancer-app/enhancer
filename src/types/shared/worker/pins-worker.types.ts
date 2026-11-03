import type { PlatformType } from "$types/shared/platform.types.ts";

export type ChannelPinRecord = {
	id: string;
	platform: PlatformType;
	login: string;
	pinnedAt: number;
};

export interface SetChannelPinnedPayload {
	platform: PlatformType;
	login: string;
	pinned: boolean;
}

export interface GetChannelPinsPayload {
	platform: PlatformType;
}

export interface ChannelPinsPayload {
	platform: PlatformType;
	logins: string[];
}
