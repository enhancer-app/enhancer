import { createPlaylistLoader } from "$shared/utils/stream-preview.utils.ts";
import type { StreamPreviewComponentProps } from "$types/shared/components/stream-preview.component.types.ts";
import type Hls from "hls.js";
import { useEffect, useRef } from "preact/hooks";
import styled from "styled-components";

const PREVIEW_HEIGHT = 360;

export function StreamPreviewComponent({
	platform,
	login,
	resolveUrl,
	onPlaying,
	onFailed,
	playlistFetcher,
	className,
}: StreamPreviewComponentProps) {
	const videoRef = useRef<HTMLVideoElement>(null);

	useEffect(() => {
		const video = videoRef.current;
		if (!video) return;
		let disposed = false;
		let hls: Hls | null = null;

		void Promise.all([import("hls.js"), resolveUrl(platform, login)])
			.then(([{ default: HlsPlayer, Events, LoadStats }, url]) => {
				if (disposed) return;
				if (!url || !HlsPlayer.isSupported()) {
					onFailed?.();
					return;
				}
				hls = new HlsPlayer({
					enableWorker: false,
					...(playlistFetcher ? { pLoader: createPlaylistLoader(playlistFetcher, LoadStats) } : {}),
					capLevelToPlayerSize: true,
					maxBufferLength: 6,
					backBufferLength: 0,
					liveSyncDurationCount: 2,
				});
				hls.on(Events.MANIFEST_PARSED, (_event, data) => {
					const level = data.levels.findIndex((candidate) => candidate.height >= PREVIEW_HEIGHT);
					if (hls && level >= 0) hls.startLevel = level;
				});
				hls.on(Events.ERROR, (_event, data) => {
					if (data.fatal && !disposed) onFailed?.();
				});
				hls.loadSource(url);
				hls.attachMedia(video);
			})
			.catch(() => {
				if (!disposed) onFailed?.();
			});

		return () => {
			disposed = true;
			hls?.destroy();
			video.removeAttribute("src");
			video.load();
		};
	}, [platform, login, resolveUrl, playlistFetcher]);

	return <Video ref={videoRef} className={className} muted autoplay playsInline onPlaying={onPlaying} />;
}

const Video = styled.video`
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
	background: transparent;
`;
