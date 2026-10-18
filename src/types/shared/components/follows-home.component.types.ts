import type { PlatformType } from "$types/shared/platform.types.ts";
import type {
	CrossPlatformChannel,
	CrossPlatformFollowsSnapshot,
	FollowsSortOrder,
} from "$types/shared/worker/cross-platform-follows-worker.types.ts";

export type FollowsHomeChannel = CrossPlatformChannel & {
	platform: PlatformType;
	checkedAt: number | null;
};

export type FollowsHomeFilter = PlatformType | "all";

export type FollowsHomeSort = FollowsSortOrder;

export type FollowsHomeSnapshots = Partial<Record<PlatformType, CrossPlatformFollowsSnapshot>>;

export interface FollowsHomeTileProps {
	channel: FollowsHomeChannel;
	now: number;
	onNavigate: (url: string, event: MouseEvent) => void;
	onTogglePin?: (channel: FollowsHomeChannel) => void;
}

export type FollowsHomeMessage =
	| { source: "enhancer-follows-home"; type: "navigate"; url: string }
	| { source: "enhancer-follows-home"; type: "show-original" };
