import type EmotesApi from "$shared/apis/emotes.api.ts";
import type { Logger } from "$shared/logger/logger.ts";
import type {
	EmoteCatalog,
	EmoteCatalogContext,
	EmoteProvider,
	FfzEmotesModule,
	SevenTvChannelRecord,
	SevenTvEmoteSetRecord,
	SevenTvEntitlementRecord,
} from "$types/platforms/twitch/twitch.emote-bar.types.ts";

const SEVENTV_DATABASES = ["seventv", "7tv-next"];
const SEVENTV_RETRIES = 5;
const SEVENTV_RETRY_DELAY = 3000;
const BTTV_FFZ_EMOTES = 1 << 2;
const BTTV_SEVENTV_EMOTES = 1 << 4;
const BTTV_DEFAULT_EMOTES = BTTV_FFZ_EMOTES | BTTV_SEVENTV_EMOTES;

const PROVIDER_HOSTS: Record<string, EmoteProvider> = {
	"static-cdn.jtvnw.net": "twitch",
	"cdn.7tv.app": "7tv",
	"cdn.betterttv.net": "bttv",
	"cdn.frankerfacez.com": "ffz",
};

export function getProviderFromUrl(url: string): EmoteProvider | null {
	try {
		return PROVIDER_HOSTS[new URL(url, location.href).hostname] ?? null;
	} catch {
		return null;
	}
}

export default class EmoteBarCatalog {
	private readonly cache = new Map<string, Promise<EmoteCatalog>>();

	constructor(
		private readonly emotesApi: EmotesApi,
		private readonly logger: Logger,
	) {}

	load(context: EmoteCatalogContext): Promise<EmoteCatalog> {
		const key = `${context.channelId}:${context.is7TV}:${this.isFfzActive()}:${this.isBttvActive()}`;
		const cached = this.cache.get(key);
		if (cached) return cached;
		const catalog = this.build(context);
		this.cache.set(key, catalog);
		catalog.catch(() => this.cache.delete(key));
		return catalog;
	}

	private async build(context: EmoteCatalogContext): Promise<EmoteCatalog> {
		const providers = new Set<EmoteProvider>(["twitch"]);
		const names = new Map<EmoteProvider, Set<string>>();
		const addName = (provider: EmoteProvider, name: string) => {
			let set = names.get(provider);
			if (!set) names.set(provider, (set = new Set()));
			set.add(name);
		};

		if (context.is7TV) {
			providers.add("7tv");
			await this.loadSevenTv(context, providers, addName);
		}
		if (this.isFfzActive()) {
			providers.add("ffz");
			this.loadFfz(context, providers, addName);
		}
		if (this.isBttvActive()) {
			providers.add("bttv");
			const flags = this.getBttvEmoteFlags();
			if (flags & BTTV_FFZ_EMOTES) providers.add("ffz");
			if (flags & BTTV_SEVENTV_EMOTES) providers.add("7tv");
		}

		const missing = [...providers].filter((provider) => provider !== "twitch" && !names.has(provider));
		if (missing.length > 0 && context.channelLogin) {
			try {
				const fallback = await this.emotesApi.getEmoteNames(context.channelLogin, missing);
				for (const provider of missing) names.set(provider, fallback.get(provider) ?? new Set());
			} catch (error) {
				this.logger.warn("Emote catalog fallback failed", error);
			}
		}

		this.logger.debug(
			"Emote catalog loaded",
			[...providers].map((provider) => `${provider}:${names.get(provider)?.size ?? "?"}`).join(" "),
		);
		return { providers, names, loadedAt: Date.now() };
	}

	private async loadSevenTv(
		context: EmoteCatalogContext,
		providers: Set<EmoteProvider>,
		addName: (provider: EmoteProvider, name: string) => void,
	) {
		for (let attempt = 0; attempt < SEVENTV_RETRIES; attempt++) {
			try {
				if (await this.readSevenTv(context, providers, addName)) return;
			} catch (error) {
				this.logger.warn("Failed to read 7TV emote cache", error);
				return;
			}
			await new Promise((resolve) => setTimeout(resolve, SEVENTV_RETRY_DELAY));
		}
	}

	private async readSevenTv(
		context: EmoteCatalogContext,
		providers: Set<EmoteProvider>,
		addName: (provider: EmoteProvider, name: string) => void,
	): Promise<boolean> {
		const existing = new Set((await indexedDB.databases()).map((database) => database.name));
		let best: { database: IDBDatabase; channel: SevenTvChannelRecord } | null = null;
		for (const name of SEVENTV_DATABASES) {
			if (!existing.has(name)) continue;
			const database = await openDatabase(name);
			const channel = database.objectStoreNames.contains("channels")
				? await getRecord<SevenTvChannelRecord>(database, "channels", context.channelId)
				: undefined;
			if (channel && (!best || (channel.timestamp ?? 0) > (best.channel.timestamp ?? 0))) {
				best?.database.close();
				best = { database, channel };
			} else {
				database.close();
			}
		}
		if (!best) return false;

		const { database, channel } = best;
		try {
			const setIds = new Set(channel.set_ids ?? channel.setIds ?? []);
			if (context.userId && database.objectStoreNames.contains("entitlements")) {
				const entitlements = await getAllRecords<SevenTvEntitlementRecord>(database, "entitlements");
				for (const entitlement of entitlements) {
					if (entitlement.kind === "EMOTE_SET" && entitlement.platform_id === context.userId && entitlement.ref_id) {
						setIds.add(entitlement.ref_id);
					}
				}
			}
			const sets = await getAllRecords<SevenTvEmoteSetRecord>(database, "emoteSets");
			for (const set of sets) {
				if (!setIds.has(set.id) && set.scope !== "GLOBAL") continue;
				const provider = this.mapSevenTvProvider(set.provider);
				if (!provider) continue;
				providers.add(provider);
				for (const emote of set.emotes ?? []) addName(provider, emote.name);
			}
			return true;
		} finally {
			database.close();
		}
	}

	private loadFfz(
		context: EmoteCatalogContext,
		providers: Set<EmoteProvider>,
		addName: (provider: EmoteProvider, name: string) => void,
	) {
		try {
			const emotes = (window as any).ffz.resolve("chat.emotes") as FfzEmotesModule | undefined;
			if (!emotes?.getSetIDs) return;
			const setIds = emotes.getSetIDs(context.userId, context.userLogin, context.channelId, context.channelLogin);
			for (const setId of setIds ?? []) {
				for (const emote of Object.values(emotes.emote_sets[String(setId)]?.emotes ?? {})) {
					const url = emote.urls?.["1"] ?? Object.values(emote.urls ?? {})[0];
					const provider = (url && getProviderFromUrl(url)) || "ffz";
					providers.add(provider);
					addName(provider, emote.name);
				}
			}
		} catch (error) {
			this.logger.warn("Failed to read FFZ emotes", error);
		}
	}

	private getBttvEmoteFlags(): number {
		try {
			const value = (window as any).BetterTTV?.settings?.get?.("emotes");
			if (typeof value === "number") return value;
			const stored = JSON.parse(localStorage.getItem("bttv_settings") ?? "{}").emotes;
			if (Array.isArray(stored) && typeof stored[0] === "number") return stored[0];
		} catch {}
		return BTTV_DEFAULT_EMOTES;
	}

	private mapSevenTvProvider(provider?: string): EmoteProvider | null {
		switch (provider) {
			case "7TV":
				return "7tv";
			case "BTTV":
				return "bttv";
			case "FFZ":
				return "ffz";
			default:
				return null;
		}
	}

	private isFfzActive(): boolean {
		return typeof (window as any).ffz?.resolve === "function";
	}

	private isBttvActive(): boolean {
		return !!(window as any).BetterTTV;
	}
}

function openDatabase(name: string): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(name);
		request.onsuccess = () => {
			request.result.onversionchange = () => request.result.close();
			resolve(request.result);
		};
		request.onerror = () => reject(request.error);
		request.onblocked = () => reject(new Error(`IndexedDB ${name} is blocked`));
	});
}

function getRecord<T>(database: IDBDatabase, store: string, key: string): Promise<T | undefined> {
	return new Promise((resolve, reject) => {
		const request = database.transaction(store, "readonly").objectStore(store).get(key);
		request.onsuccess = () => resolve(request.result as T | undefined);
		request.onerror = () => reject(request.error);
	});
}

function getAllRecords<T>(database: IDBDatabase, store: string): Promise<T[]> {
	return new Promise((resolve, reject) => {
		const request = database.transaction(store, "readonly").objectStore(store).getAll();
		request.onsuccess = () => resolve(request.result as T[]);
		request.onerror = () => reject(request.error);
	});
}
