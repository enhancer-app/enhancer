import type { SidebarChannel } from "$types/shared/components/cross-platform-follows.component.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type {
	CrossPlatformFollowsSnapshot,
	FollowsSortOrder,
} from "$types/shared/worker/cross-platform-follows-worker.types.ts";

export type FollowsHomeChannel = SidebarChannel & {
	checkedAt: number | null;
};

export type FollowsHomeSort = FollowsSortOrder;

export type FollowsHomeSnapshots = Partial<Record<PlatformType, CrossPlatformFollowsSnapshot>>;

export interface FollowsHomeTileProps {
	channel: FollowsHomeChannel;
	now: number;
	onNavigate: (url: string, event: MouseEvent) => void;
	onTogglePin?: (channel: FollowsHomeChannel) => void;
	onContextMenu: (event: MouseEvent, channel: FollowsHomeChannel) => void;
}

export type FollowsHomeMessage =
	| { source: "enhancer-follows-home"; type: "navigate"; url: string }
	| { source: "enhancer-follows-home"; type: "show-original" };
