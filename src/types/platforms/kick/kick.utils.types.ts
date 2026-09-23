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

export type KickQualityVariantSource = "auto" | "source" | "transcode";

export type KickPlayerQuality = {
	name: string;
	width: number;
	height: number;
	bitrate: number;
	variantSource: KickQualityVariantSource;
};

export type KickQualityController = {
	qualities: KickPlayerQuality[];
	setQuality: (quality: KickPlayerQuality, adaptive: boolean) => void;
};
