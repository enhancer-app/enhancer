import type { PlatformType } from "$types/shared/platform.types.ts";

export type ChannelLink = {
	twitch: string;
	kick: string;
	primary: PlatformType;
};

export type ChannelLinkRecord = ChannelLink & {
	id: string;
	updatedAt: number;
};

export interface UpdateChannelLinkPayload {
	twitch: string;
	kick: string;
	primary: PlatformType;
}

export interface RemoveChannelLinkPayload {
	twitch: string;
	kick: string;
}

export interface ChannelLinksPayload {
	links: ChannelLink[];
}
