import { HttpClient } from "$shared/http/http-client.ts";
import { Logger } from "$shared/logger/logger.ts";
import type { PlatformStatusScraper } from "$shared/worker/shared-followers/scrapers/platform-status.scraper.ts";
import type {
	GQLResponse,
	TwitchMultiStreamResponse,
	TwitchUserData,
} from "$types/platforms/twitch/twitch.api.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { StreamStatusResult } from "$types/shared/worker/shared-storage.types.ts";

export class TwitchStatusScraper implements PlatformStatusScraper {
	readonly platform: PlatformType = "twitch";
	readonly maxBatchSize = 30;

	private readonly logger = new Logger({ context: "twitch-status-scraper" });
	private readonly http = new HttpClient(this.logger);

	private static readonly GQL_URL = "https://gql.twitch.tv/gql";
	private static readonly CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
	private static readonly REQUEST_TIMEOUT_MS = 10_000;

	async checkStatusBatch(channelLogins: string[]): Promise<Map<string, StreamStatusResult>> {
		const results = new Map<string, StreamStatusResult>();

		const chunks = this.chunkArray(channelLogins, this.maxBatchSize);

		for (const chunk of chunks) {
			const chunkResults = await this.fetchChunk(chunk);
			for (const [login, result] of chunkResults) {
				results.set(login, result);
			}
		}

		for (const login of channelLogins) {
			if (!results.has(login)) {
				results.set(login, {
					displayName: null,
					isLive: false,
					gameName: null,
					title: null,
					viewerCount: 0,
					startedAt: null,
					profilePictureUrl: null,
				});
			}
		}

		return results;
	}

	private async fetchChunk(channelLogins: string[]): Promise<Map<string, StreamStatusResult>> {
		const results = new Map<string, StreamStatusResult>();

		const query = this.buildQuery(channelLogins);
		const variables: Record<string, string> = {};
		channelLogins.forEach((login, index) => {
			variables[`login${index + 1}`] = login;
		});

		try {
			const { data } = await this.http.request<GQLResponse<TwitchMultiStreamResponse>>(TwitchStatusScraper.GQL_URL, {
				method: "POST",
				timeout: TwitchStatusScraper.REQUEST_TIMEOUT_MS,
				headers: {
					"client-id": TwitchStatusScraper.CLIENT_ID,
					"content-type": "application/json",
					origin: "https://www.twitch.tv",
					referer: "https://www.twitch.tv/",
				},
				body: JSON.stringify({
					operationName: "GetMultiStreamInfo",
					variables,
					query,
				}),
			});

			const entries = Object.entries(data.data) as unknown as Array<[string, TwitchUserData | null]>;
			for (const [alias, userData] of entries) {
				if (!userData) {
					results.set(alias, {
						displayName: null,
						isLive: false,
						gameName: null,
						title: null,
						viewerCount: 0,
						startedAt: null,
						profilePictureUrl: null,
					});
					continue;
				}

				const stream = userData.stream;
				if (!stream || stream.type !== "live") {
					results.set(userData.login, {
						displayName: userData.displayName,
						isLive: false,
						gameName: null,
						title: null,
						viewerCount: 0,
						startedAt: null,
						profilePictureUrl: userData.profileImageURL,
					});
				} else {
					results.set(userData.login, {
						displayName: userData.displayName,
						isLive: true,
						gameName: stream.game?.displayName ?? null,
						title: stream?.title ?? null,
						viewerCount: stream.viewersCount ?? 0,
						startedAt: null,
						profilePictureUrl: userData.profileImageURL,
					});
				}
			}
		} catch (error) {
			this.logger.warn("Failed to fetch Twitch status for chunk:", error);
			for (const login of channelLogins) {
				results.set(login, {
					displayName: null,
					isLive: false,
					gameName: null,
					viewerCount: 0,
					title: null,
					startedAt: null,
					profilePictureUrl: null,
				});
			}
		}

		return results;
	}

	private buildQuery(channelLogins: string[]): string {
		const fragments = channelLogins
			.map(
				(login, index) =>
					`${login}: user(login: $login${index + 1}) { login displayName profileImageURL(width: 70) stream { type viewersCount title game { displayName } } }`,
			)
			.join("\n");

		return `query GetMultiStreamInfo(${channelLogins.map((_, i) => `$login${i + 1}: String!`).join(", ")}) { ${fragments} }`;
	}

	private chunkArray<T>(array: T[], size: number): T[][] {
		const chunks: T[][] = [];
		for (let i = 0; i < array.length; i += size) {
			chunks.push(array.slice(i, i + size));
		}
		return chunks;
	}
}
