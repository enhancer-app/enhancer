import type { PlaylistProxyRequest, PlaylistProxyResponse } from "$types/shared/utils/playlist-proxy.types.ts";

export const PLAYLIST_PROXY_FRAME_NAME = "enhancer-playlist-proxy";

const PLAYLIST_HOSTS = [".ttvnw.net", ".live-video.net"];
const PARENT_HOSTS = ["twitch.tv", "kick.com"];

function matchesHost(hostname: string, domain: string): boolean {
	return hostname === domain || hostname.endsWith(`.${domain}`);
}

function isTrustedParentOrigin(origin: string): boolean {
	if (origin === new URL(chrome.runtime.getURL("")).origin) return true;
	try {
		const { protocol, hostname } = new URL(origin);
		return protocol === "https:" && PARENT_HOSTS.some((domain) => matchesHost(hostname, domain));
	} catch {
		return false;
	}
}

function isPlaylistUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === "https:" && PLAYLIST_HOSTS.some((suffix) => url.hostname.endsWith(suffix));
	} catch {
		return false;
	}
}

async function fetchPlaylist(url: string): Promise<{ url: string; data: string }> {
	if (!isPlaylistUrl(url)) throw new Error("URL not allowed");
	const response = await fetch(url, { credentials: "omit" });
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	return { url: response.url, data: await response.text() };
}

export function runPlaylistProxy(): void {
	window.addEventListener("message", (event: MessageEvent<PlaylistProxyRequest>) => {
		if (event.source !== window.parent || !isTrustedParentOrigin(event.origin)) return;
		const request = event.data;
		if (request?.source !== "enhancer-playlist-proxy-client") return;
		const reply = (response: PlaylistProxyResponse) => window.parent.postMessage(response, event.origin);
		fetchPlaylist(request.url).then(
			(result) => reply({ source: "enhancer-playlist-proxy", type: "result", id: request.id, ...result }),
			(error: unknown) =>
				reply({ source: "enhancer-playlist-proxy", type: "error", id: request.id, error: String(error) }),
		);
	});
	const ready: PlaylistProxyResponse = { source: "enhancer-playlist-proxy", type: "ready" };
	window.parent.postMessage(ready, "*");
}
