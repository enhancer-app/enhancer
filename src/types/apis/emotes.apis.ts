export type EmotesApiProvider = "twitch" | "7tv" | "bttv" | "ffz";

export type EmotesApiEmote = {
	id: string;
	provider: EmotesApiProvider;
	code: string;
	urls: { size: string; url: string }[];
};

export type EmotesApiCollection = {
	twitch?: Partial<Record<EmotesApiProvider, EmotesApiEmote[]>>;
};
