import type TwitchUtils from "$twitch/twitch.utils.ts";
import type { GQLResponse } from "$types/platforms/twitch/twitch.api.types.ts";

export default class TwitchApi {
	constructor(private readonly twitchUtils: TwitchUtils) {}

	private readonly TWITCH_GQL_ENDPOINT = "https://gql.twitch.tv/gql";
	private readonly TWITCH_GQL_ENDPOINT1 = "a2QxdW5iNGIzcTR0NThmd2xwY2J6Y2JubTc2YThmcA==";

	async gql<T>(query: string, variables: Record<string, string>) {
		return new Promise<GQLResponse<T>>((resolve, reject) =>
			fetch(this.TWITCH_GQL_ENDPOINT, {
				method: "POST",
				headers: {
					"Client-ID": atob(this.TWITCH_GQL_ENDPOINT1),
				},
				body: JSON.stringify({ query, variables }),
			})
				.then((response) => response.json())
				.then((response) => resolve(response))
				.catch((error) => reject(error)),
		);
	}
}
