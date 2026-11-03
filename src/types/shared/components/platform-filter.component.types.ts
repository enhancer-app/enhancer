import type { ComponentChildren } from "preact";
import type { FollowsPlatformFilter } from "$types/shared/worker/cross-platform-follows-worker.types.ts";

export type PlatformFilterTheme = "home" | "twitch" | "kick";

export interface PlatformFilterComponentProps {
	value: FollowsPlatformFilter;
	onChange: (filter: FollowsPlatformFilter) => void;
	theme: PlatformFilterTheme;
	liveCounts?: Record<FollowsPlatformFilter, number>;
	children?: ComponentChildren;
}
