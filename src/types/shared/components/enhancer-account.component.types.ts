import type WorkerService from "$shared/worker/worker.service.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type {
	EnhancerChatAccountStyle,
	EnhancerChatStylePerks,
	EnhancerViewerBadge,
	SaveChatStyleRequest,
} from "$types/apis/enhancer-account.apis.ts";
import type { WorkerClient } from "$types/shared/worker/worker-client.types.ts";
import type { SettingsIdentityProps } from "$types/shared/components/settings.component.types.ts";

export type EnhancerAccountComponentProps = {
	workerService: WorkerClient;
	platform: PlatformType;
	logoUrl: string;
};

export type BadgeSlotGroup = {
	key: string;
	scope: "GLOBAL" | "CHANNEL";
	accountId: string;
	accountPlatform: "TWITCH" | "KICK";
	accountLogin: string;
	channelId: string | null;
	channelLogin: string | null;
	channelDisplayName: string | null;
	channelAvatarUrl: string | null;
	badges: EnhancerViewerBadge[];
	selectedAssignmentId: string | null;
	cooldownUntil: string | null;
};

export type BadgeSlotEditorProps = {
	group: BadgeSlotGroup;
	onSave: (group: BadgeSlotGroup, assignmentId: string | null) => Promise<string | null>;
};

export type LoginScreenProps = {
	logoUrl: string;
	busy: boolean;
	error: string | null;
	onLogin: () => void;
};

export type EnhancerAccountIdentityProps = SettingsIdentityProps & {
	workerService: WorkerService;
	platform: PlatformType;
};

export type ChatStyleCardProps = {
	perks: EnhancerChatStylePerks;
	account: EnhancerChatAccountStyle;
	plansAvailable: boolean;
	onSaveStyle: (style: SaveChatStyleRequest) => Promise<string | null>;
	onSubmitNickname: (accountId: string, nickname: string) => Promise<string | null>;
	onClearNickname: (accountId: string) => Promise<string | null>;
};

export type ChatStyleNotice = { tone: "success" | "error"; text: string };

export type EnhancerAccountFrameProps = {
	platform: PlatformType;
	logoUrl: string;
};
