import type { Signal } from "@preact/signals";

export type EmoteProvider = "twitch" | "7tv" | "bttv" | "ffz";

export type UsedEmote = {
	name: string;
	src: string;
	provider: EmoteProvider;
	ratio: number;
};

export type EmoteBarEntry = UsedEmote & {
	score: number;
	lastUsed: number;
};

export type EmoteBarChannel = {
	entries: EmoteBarEntry[];
	updatedAt: number;
};

export type EmoteBarStore = Record<string, EmoteBarChannel>;

export type EmoteCatalog = {
	providers: Set<EmoteProvider>;
	names: Map<EmoteProvider, Set<string>>;
	loadedAt: number;
};

export type EmoteBarRemovalState = "none" | "pending" | "armed";

export type EmoteBarRemoval = {
	name: string;
	armed: boolean;
};

export type EmoteBarProps = {
	entries: Signal<EmoteBarEntry[]>;
	catalog: Signal<EmoteCatalog | null>;
	onInsert: (name: string) => void;
	onSend: (name: string) => void;
	onRemove: (name: string) => void;
	onRatio: (name: string, ratio: number) => void;
};

export type EmoteCatalogContext = {
	channelId: string;
	channelLogin: string;
	userId?: string;
	userLogin?: string;
	is7TV: boolean;
};

export type SevenTvEmoteSetRecord = {
	id: string;
	provider?: string;
	scope?: string;
	emotes?: { name: string }[];
};

export type SevenTvChannelRecord = {
	id: string;
	set_ids?: string[];
	setIds?: string[];
	timestamp?: number;
};

export type SevenTvEntitlementRecord = {
	kind?: string;
	ref_id?: string;
	platform_id?: string;
};

export type FfzEmoteSet = {
	emotes?: Record<string, { name: string; urls?: Record<string, string> }>;
};

export type FfzEmotesModule = {
	getSetIDs: (userId?: string, userLogin?: string, roomId?: string, roomLogin?: string) => (string | number)[];
	emote_sets: Record<string, FfzEmoteSet | undefined>;
};

export type TwilightUser = {
	id?: string;
	login?: string;
};
