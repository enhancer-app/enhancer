export type TwitchEmoteBarItem = {
	src: string;
	alt: string;
};

export type TwitchStorage = {
	emoteBarByChannel?: Record<string, TwitchEmoteBarItem[]>;
};
