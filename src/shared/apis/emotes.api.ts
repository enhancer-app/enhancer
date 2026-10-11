import { HttpClient } from "$shared/http/http-client.ts";
import { Logger } from "$shared/logger/logger.ts";
import type { EmotesApiCollection, EmotesApiProvider } from "$types/apis/emotes.apis.ts";

export default class EmotesApi {
	private static readonly API_URL = "https://emotes-api.enhancer.at";
	private readonly logger = new Logger({ context: "emotes-api" });
	private readonly httpClient = new HttpClient(this.logger);
	private readonly cache = new Map<string, Promise<Map<EmotesApiProvider, Set<string>>>>();

	async getEmoteNames(
		channelLogin: string,
		providers: EmotesApiProvider[],
	): Promise<Map<EmotesApiProvider, Set<string>>> {
		const query = `platform=twitch&provider=${[...providers].sort().join(",")}`;
		const [global, channel] = await Promise.all([
			this.fetchNames(`/v1/global/emotes?${query}`),
			this.fetchNames(`/v1/channel/${encodeURIComponent(channelLogin.toLowerCase())}/emotes?${query}`),
		]);
		const names = new Map<EmotesApiProvider, Set<string>>();
		for (const provider of providers) {
			names.set(provider, new Set([...(global.get(provider) ?? []), ...(channel.get(provider) ?? [])]));
		}
		return names;
	}

	private fetchNames(path: string): Promise<Map<EmotesApiProvider, Set<string>>> {
		const cached = this.cache.get(path);
		if (cached) return cached;
		const request = this.httpClient
			.request<EmotesApiCollection>(`${EmotesApi.API_URL}${path}`, { timeout: 15000 })
			.then(({ data }) => {
				const names = new Map<EmotesApiProvider, Set<string>>();
				for (const [provider, emotes] of Object.entries(data.twitch ?? {})) {
					names.set(provider as EmotesApiProvider, new Set((emotes ?? []).map((emote) => emote.code)));
				}
				return names;
			});
		this.cache.set(path, request);
		request.catch((error) => {
			this.cache.delete(path);
			this.logger.warn(`Failed to fetch ${path}`, error);
		});
		return request;
	}
}
