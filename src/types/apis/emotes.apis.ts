export type EmotesApiPlatform = "twitch" | "kick";

export type EmotesApiProvider = "twitch" | "7tv" | "bttv" | "ffz" | "kick";

export type EmotesApiEmote = {
	id: string;
	provider: EmotesApiProvider;
	code: string;
	urls: { size: string; url: string }[];
};

export type EmotesApiProviderEmotes = Map<EmotesApiProvider, EmotesApiEmote[]>;

export type EmotesApiCollection = Partial<
	Record<EmotesApiPlatform, Partial<Record<EmotesApiProvider, EmotesApiEmote[]>>>
>;
