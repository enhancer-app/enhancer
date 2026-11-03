import { HttpClient } from "$shared/http/http-client.ts";
import { Logger } from "$shared/logger/logger.ts";
import type {
	EmotesApiCollection,
	EmotesApiPlatform,
	EmotesApiProvider,
	EmotesApiProviderEmotes,
} from "$types/apis/emotes.apis.ts";

export default class EmotesApi {
	private static readonly API_URL = "https://emotes-api.enhancer.at";
	private readonly logger = new Logger({ context: "emotes-api" });
	private readonly httpClient = new HttpClient(this.logger);
	private readonly cache = new Map<string, Promise<EmotesApiProviderEmotes>>();

	constructor(private readonly platform: EmotesApiPlatform) {}

	getGlobalEmotes(providers: EmotesApiProvider[]): Promise<EmotesApiProviderEmotes> {
		return this.fetchEmotes(`/v1/global/emotes?${this.query(providers)}`);
	}

	getChannelEmotes(channelLogin: string, providers: EmotesApiProvider[]): Promise<EmotesApiProviderEmotes> {
		const channel = encodeURIComponent(channelLogin.toLowerCase());
		return this.fetchEmotes(`/v1/channel/${channel}/emotes?${this.query(providers)}`);
	}

	async getEmoteNames(
		channelLogin: string,
		providers: EmotesApiProvider[],
	): Promise<Map<EmotesApiProvider, Set<string>>> {
		const [global, channel] = await Promise.all([
			this.getGlobalEmotes(providers),
			this.getChannelEmotes(channelLogin, providers),
		]);
		const names = new Map<EmotesApiProvider, Set<string>>();
		for (const provider of providers) {
			const emotes = [...(global.get(provider) ?? []), ...(channel.get(provider) ?? [])];
			names.set(provider, new Set(emotes.map((emote) => emote.code)));
		}
		return names;
	}

	private query(providers: EmotesApiProvider[]): string {
		return `platform=${this.platform}&provider=${[...providers].sort().join(",")}`;
	}

	private fetchEmotes(path: string): Promise<EmotesApiProviderEmotes> {
		const cached = this.cache.get(path);
		if (cached) return cached;
		const request = this.httpClient
			.request<EmotesApiCollection>(`${EmotesApi.API_URL}${path}`, { timeout: 15000 })
			.then(({ data }) => {
				const emotes: EmotesApiProviderEmotes = new Map();
				for (const [provider, providerEmotes] of Object.entries(data[this.platform] ?? {})) {
					emotes.set(provider as EmotesApiProvider, providerEmotes ?? []);
				}
				return emotes;
			});
		this.cache.set(path, request);
		request.catch((error) => {
			this.cache.delete(path);
			this.logger.warn(`Failed to fetch ${path}`, error);
		});
		return request;
	}
}
