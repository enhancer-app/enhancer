import type WorkerService from "$shared/worker/worker.service.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type {
	CrossPlatformChannel,
	FollowsPlatformFilter,
	FollowsSortOrder,
} from "$types/shared/worker/cross-platform-follows-worker.types.ts";

export type CrossPlatformFollowsComponentProps = {
	hostPlatform: PlatformType;
	workerService: WorkerService;
	title: string | null;
	pinsEnabled: boolean;
	sort: FollowsSortOrder;
	onSortChange: (sort: FollowsSortOrder) => void;
	platformFilter: FollowsPlatformFilter;
	onPlatformFilterChange: (filter: FollowsPlatformFilter) => void;
	onNavigate: (url: string) => void;
};

export type SidebarChannel = CrossPlatformChannel & { platform: PlatformType; linked?: LinkedChannels };

export type LinkedChannels = {
	channels: Record<PlatformType, SidebarChannel>;
	primary: PlatformType;
};

export type ChannelMenuState = { channel: SidebarChannel; anchor: Element; x: number; y: number };

export type ChannelContextMenuProps = ChannelMenuState & {
	host: PlatformType;
	pinsEnabled: boolean;
	onTogglePin: (channel: SidebarChannel) => void;
	onLink: (channel: SidebarChannel) => void;
	onPrefer: (channel: SidebarChannel, primary: PlatformType) => void;
	onUnlink: (channel: SidebarChannel) => void;
	onClose: () => void;
};

export type LinkChannelDialogProps = {
	channel: SidebarChannel;
	channels: SidebarChannel[];
	host: PlatformType;
	onLink: (target: SidebarChannel, primary: PlatformType) => void;
	onClose: () => void;
};

export type SidebarChannelRowProps = {
	channel: SidebarChannel;
	host: PlatformType;
	compact: boolean;
	now: number;
	onTogglePin?: (channel: SidebarChannel) => void;
	onContextMenu?: (event: MouseEvent, channel: SidebarChannel) => void;
	onNavigate: (url: string) => void;
	resolvePreviewUrl: (platform: PlatformType, login: string) => Promise<string | null>;
};
