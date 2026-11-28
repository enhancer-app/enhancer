export interface PlaylistFetchResult {
	url: string;
	data: string;
}

export type PlaylistFetcher = (url: string) => Promise<PlaylistFetchResult>;

export type PlaylistProxyRequest = { source: "enhancer-playlist-proxy-client"; id: number; url: string };

export type PlaylistProxyResponse =
	| { source: "enhancer-playlist-proxy"; type: "ready" }
	| { source: "enhancer-playlist-proxy"; type: "result"; id: number; url: string; data: string }
	| { source: "enhancer-playlist-proxy"; type: "error"; id: number; error: string };
