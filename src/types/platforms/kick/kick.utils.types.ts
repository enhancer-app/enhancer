import KickModule from "$kick/kick.module.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";

export type ChannelInfo = {
	slug: string;
	channelId: number;
};

export type IsoDateProps = {
	isoDate: string;
};

export type VideoProgressProps = {
	durationInMs: number;
	currentProgressInMs: number;
	loadedInMs: number;
};

export type StreamStatusProps = {
	isLive: boolean;
	isPlaying: boolean;
};

export type ChannelChatRoomInfo = {
	slug: string;
};

export type ChannelChatRoom = {
	isPaused: boolean;
	setIsPaused: (paused: boolean) => void;
};

type TwitchStreamerInfo = {
	username: string;
	isLive: boolean;
	game: string | null;
	avatar: string | null;
	url: string;
	viewerCount: number;
};

type StreamerInfo = TwitchStreamerInfo & { platform: string };
