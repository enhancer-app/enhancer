import type WorkerService from "$shared/worker/worker.service.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type {
	CrossPlatformChannel,
	FollowsSortOrder,
} from "$types/shared/worker/cross-platform-follows-worker.types.ts";

export type CrossPlatformFollowsComponentProps = {
	hostPlatform: PlatformType;
	workerService: WorkerService;
	title: string | null;
	pinsEnabled: boolean;
	sort: FollowsSortOrder;
	onSortChange: (sort: FollowsSortOrder) => void;
	onNavigate: (url: string) => void;
};

export type SidebarChannel = CrossPlatformChannel & { platform: PlatformType };

export type SidebarChannelRowProps = {
	channel: SidebarChannel;
	host: PlatformType;
	compact: boolean;
	now: number;
	onTogglePin?: (channel: SidebarChannel) => void;
	onNavigate: (url: string) => void;
	resolvePreviewUrl: (platform: PlatformType, login: string) => Promise<string | null>;
};
