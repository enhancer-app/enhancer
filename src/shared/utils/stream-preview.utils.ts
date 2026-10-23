import type { PlatformType } from "$types/shared/platform.types.ts";
import type { PlaylistFetcher } from "$types/shared/utils/playlist-proxy.types.ts";
import type { Loader, LoaderCallbacks, LoadStats, PlaylistLoaderConstructor, PlaylistLoaderContext } from "hls.js";

const TWITCH_GQL_ENDPOINT = "https://gql.twitch.tv/gql";
const TWITCH_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
const TWITCH_ACCESS_TOKEN_QUERY = `query EnhancerPreviewToken($login: String!) {
	streamPlaybackAccessToken(channelName: $login, params: { platform: "web", playerBackend: "mediaplayer", playerType: "embed" }) {
		value
		signature
	}
}`;

export async function resolvePlaybackUrl(platform: PlatformType, login: string): Promise<string | null> {
	return platform === "kick" ? resolveKickPlayback(login) : resolveTwitchPlayback(login);
}

async function resolveKickPlayback(slug: string): Promise<string | null> {
	const response = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}/playback-url`, {
		headers: { Accept: "application/json" },
	});
	if (!response.ok) return null;
	const body = (await response.json()) as { data?: string | null };
	return body.data || null;
}

async function resolveTwitchPlayback(login: string): Promise<string | null> {
	const response = await fetch(TWITCH_GQL_ENDPOINT, {
		method: "POST",
		headers: { "Client-ID": TWITCH_CLIENT_ID, "Content-Type": "application/json" },
		body: JSON.stringify({ query: TWITCH_ACCESS_TOKEN_QUERY, variables: { login } }),
	});
	if (!response.ok) return null;
	const body = (await response.json()) as {
		data?: { streamPlaybackAccessToken: { value: string; signature: string } | null };
	};
	const token = body.data?.streamPlaybackAccessToken;
	if (!token) return null;

	const params = new URLSearchParams({
		allow_source: "true",
		fast_bread: "true",
		player_backend: "mediaplayer",
		sig: token.signature,
		token: token.value,
		p: Math.floor(Math.random() * 1_000_000).toString(),
	});
	return `https://usher.ttvnw.net/api/channel/hls/${encodeURIComponent(login)}.m3u8?${params}`;
}

export function createPlaylistLoader(fetcher: PlaylistFetcher, Stats: typeof LoadStats): PlaylistLoaderConstructor {
	return class PlaylistProxyLoader implements Loader<PlaylistLoaderContext> {
		context: PlaylistLoaderContext | null = null;
		stats = new Stats();
		private cancelled = false;

		load(context: PlaylistLoaderContext, _config: unknown, callbacks: LoaderCallbacks<PlaylistLoaderContext>) {
			this.context = context;
			const stats = this.stats;
			stats.loading.start = performance.now();
			fetcher(context.url).then(
				({ url, data }) => {
					if (this.cancelled) return;
					stats.loading.first = stats.loading.end = performance.now();
					stats.loaded = stats.total = data.length;
					callbacks.onSuccess({ url, data, code: 200 }, stats, context, null);
				},
				(error: unknown) => {
					if (this.cancelled) return;
					callbacks.onError({ code: 0, text: String(error) }, context, null, stats);
				},
			);
		}

		abort() {
			this.cancelled = true;
			this.stats.aborted = true;
		}

		destroy() {
			this.cancelled = true;
			this.context = null;
		}
	};
}
