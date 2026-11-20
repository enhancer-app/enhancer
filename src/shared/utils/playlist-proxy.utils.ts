import type { PlatformType } from "$types/shared/platform.types.ts";
import type {
	PlaylistFetcher,
	PlaylistFetchResult,
	PlaylistProxyRequest,
	PlaylistProxyResponse,
} from "$types/shared/utils/playlist-proxy.types.ts";

const PROXY_FRAME_NAME = "enhancer-playlist-proxy";

const PROXY_FRAME_URLS: Record<PlatformType, string> = {
	twitch: "https://player.twitch.tv/robots.txt",
	kick: "https://kick.com/robots.txt",
};
const READY_TIMEOUT_MS = 10_000;
const FETCH_TIMEOUT_MS = 10_000;

const fetchers = new Map<PlatformType, PlaylistFetcher>();

function isPlatformOrigin(platform: PlatformType, hostname: string): boolean {
	return platform === "kick"
		? hostname === "kick.com" || hostname.endsWith(".kick.com")
		: hostname === "twitch.tv" || hostname.endsWith(".twitch.tv");
}

export function getPlaylistFetcher(platform: PlatformType): PlaylistFetcher | null {
	if (isPlatformOrigin(platform, window.location.hostname)) return null;
	let fetcher = fetchers.get(platform);
	if (!fetcher) {
		fetcher = createFrameFetcher(PROXY_FRAME_URLS[platform]);
		fetchers.set(platform, fetcher);
	}
	return fetcher;
}

function createFrameFetcher(frameUrl: string): PlaylistFetcher {
	const frameOrigin = new URL(frameUrl).origin;
	const pending = new Map<number, (response: PlaylistProxyResponse) => void>();
	let frame: HTMLIFrameElement | null = null;
	let ready: Promise<void> | null = null;
	let markReady: (() => void) | null = null;
	let nextId = 0;

	window.addEventListener("message", (event: MessageEvent<PlaylistProxyResponse>) => {
		if (!frame || event.source !== frame.contentWindow || event.origin !== frameOrigin) return;
		const message = event.data;
		if (message?.source !== "enhancer-playlist-proxy") return;
		if (message.type === "ready") {
			markReady?.();
			return;
		}
		pending.get(message.id)?.(message);
	});

	const ensureFrame = () => {
		if (ready && frame?.isConnected) return ready;
		frame?.remove();
		ready = new Promise<void>((resolve, reject) => {
			markReady = resolve;
			window.setTimeout(() => reject(new Error("Playlist proxy not ready")), READY_TIMEOUT_MS);
		});
		ready.catch(() => {
			ready = null;
		});
		frame = document.createElement("iframe");
		frame.name = PROXY_FRAME_NAME;
		frame.src = frameUrl;
		frame.setAttribute("aria-hidden", "true");
		frame.tabIndex = -1;
		frame.style.cssText = "position:fixed;width:0;height:0;border:0;visibility:hidden;pointer-events:none;";
		document.body.append(frame);
		return ready;
	};

	return async (url) => {
		await ensureFrame();
		const id = ++nextId;
		return new Promise<PlaylistFetchResult>((resolve, reject) => {
			const timeout = window.setTimeout(() => {
				pending.delete(id);
				reject(new Error("Playlist proxy timed out"));
			}, FETCH_TIMEOUT_MS);
			pending.set(id, (response) => {
				window.clearTimeout(timeout);
				pending.delete(id);
				if (response.type === "result") resolve({ url: response.url, data: response.data });
				else if (response.type === "error") reject(new Error(response.error));
			});
			const request: PlaylistProxyRequest = { source: "enhancer-playlist-proxy-client", id, url };
			frame?.contentWindow?.postMessage(request, frameOrigin);
		});
	};
}
