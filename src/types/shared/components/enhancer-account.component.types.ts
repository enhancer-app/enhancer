import type WorkerService from "$shared/worker/worker.service.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { EnhancerViewerBadge } from "$types/apis/enhancer-account.apis.ts";

export type EnhancerAccountComponentProps = {
	workerService: WorkerService;
	platform: PlatformType;
};

export type BadgeSlotGroup = {
	key: string;
	scope: "GLOBAL" | "CHANNEL";
	accountId: string;
	accountPlatform: "TWITCH" | "KICK";
	accountLogin: string;
	channelId: string | null;
	channelLogin: string | null;
	channelAvatarUrl: string | null;
	badges: EnhancerViewerBadge[];
	selectedAssignmentId: string | null;
	cooldownUntil: string | null;
};

export type BadgeSlotEditorProps = {
	group: BadgeSlotGroup;
	onSave: (group: BadgeSlotGroup, assignmentId: string | null) => Promise<string | null>;
};
