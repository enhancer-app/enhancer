import type { PlatformType } from "$types/shared/platform.types.ts";
import type { PlaylistFetcher } from "$types/shared/utils/playlist-proxy.types.ts";

export interface StreamPreviewComponentProps {
	platform: PlatformType;
	login: string;
	resolveUrl: (platform: PlatformType, login: string) => Promise<string | null>;
	onPlaying?: () => void;
	onFailed?: () => void;
	playlistFetcher?: PlaylistFetcher | null;
	className?: string;
}

export interface MarqueeTextComponentProps {
	text: string;
	active: boolean;
	className?: string;
}
