import type { EnhancerStreamerWatchTimeData } from "$types/apis/enhancer.apis.ts";
import type { EnhancerApiEnvironment } from "$types/shared/enhancer-environment.types.ts";
import type { LogEntry } from "$types/shared/logger.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { GlobalSettings } from "$types/shared/settings/global-settings.types.ts";
import type {
	ClearFollowsPayload,
	CrossPlatformFollowsSnapshot,
	GetFollowsStatusPayload,
	GetStreamPlaybackUrlPayload,
	SyncFollowsPayload,
	SyncKickSessionPayload,
	UpdateFollowPayload,
} from "$types/shared/worker/cross-platform-follows-worker.types.ts";
import type {
	AggregateSeed,
	DisconnectEnhancerApiPayload,
	EnhancerApiMessagePayload,
	EnhancerApiPatchPayload,
	EnhancerApiUpdatedPayload,
	GetEnhancerWatchTimePayload,
	InitializeEnhancerApiPayload,
	JoinEnhancerChannelPayload,
} from "$types/shared/worker/enhancer-api-worker.types.ts";
import type {
	EnhancerAccountBroadcastPayload,
	EnhancerAccountCard,
	EnhancerAccountState,
	GetEnhancerAccountCardPayload,
	GetEnhancerBadgesResponse,
	GetEnhancerProfileResponse,
	LoginEnhancerAccountResponse,
	LogoutEnhancerAccountResponse,
	SaveEnhancerBadgeSlotPayload,
	SaveEnhancerBadgeSlotResponse,
	ClearEnhancerNicknamePayload,
	GetEnhancerBillingResponse,
	SaveEnhancerChatStylePayload,
	SubmitEnhancerNicknamePayload,
} from "$types/shared/worker/enhancer-account-worker.types.ts";
import type {
	ChannelPinsPayload,
	GetChannelPinsPayload,
	SetChannelPinnedPayload,
} from "$types/shared/worker/pins-worker.types.ts";
import type { PlatformSettings } from "$types/shared/worker/settings-worker.types.ts";
import type {
	ChannelLinksPayload,
	RemoveChannelLinkPayload,
	UpdateChannelLinkPayload,
} from "$types/shared/worker/channel-links-worker.types.ts";

export type { PlatformType };

export interface ExtensionMessageDetail {
	messageId: string;
	action: string;
	payload?: any;
}

export interface ExtensionResponseDetail {
	messageId: string;
	data?: any;
	error?: string;
}

export interface GetAssetsFilePayload {
	path: string;
}

export interface GetAssetsFileResponse {
	url: string;
}

export interface PingResponse {
	status: "alive";
	timestamp: number;
	message: string;
	instanceId: string;
}

export interface WatchtimeRecord {
	id: string;
	platform: PlatformType;
	username: string;
	time: number;
	firstUpdate: number;
	lastUpdate: number;
}

export interface WatchtimeChannel {
	platform: PlatformType;
	username: string;
}

export interface AddWatchtimePayload {
	platform: PlatformType;
	channel: string;
}

export interface ImportWatchtimePayload {
	platform: PlatformType;
	username: string;
	time: number;
	firstUpdate?: number;
	lastUpdate?: number;
}

export interface GetWatchtimePayload {
	platform: PlatformType;
	channel: string;
}

export interface WatchtimeResponse extends WatchtimeRecord {}

export interface GetPaginatedWatchtimePayload {
	platform: PlatformType;
	page: number;
	pageSize: number;
	sortOrder?: "asc" | "desc";
}

export interface PaginatedWatchtimeResponse {
	data: WatchtimeRecord[];
	page: number;
	pageSize: number;
	total: number;
}

export interface GetSettingsPayload {
	platform: PlatformType;
}

export interface UpdateSettingsPayload {
	platform: PlatformType;
	settings: PlatformSettings;
}

export interface UpdateGlobalSettingsPayload {
	settings: Partial<GlobalSettings>;
}

export type GetSettingsResponse = PlatformSettings;
export type UpdateSettingsResponse = { success: true };

export interface WorkerApiActions {
	getLogs: {
		payload: never;
		response: LogEntry[];
	};
	ping: {
		payload?: never;
		response: PingResponse;
	};
	getAssetsFile: {
		payload: GetAssetsFilePayload;
		response: GetAssetsFileResponse;
	};
	addWatchtime: {
		payload: AddWatchtimePayload;
		response: WatchtimeResponse | null;
	};
	importWatchtime: {
		payload: ImportWatchtimePayload;
		response: WatchtimeResponse | null;
	};
	getWatchtime: {
		payload: GetWatchtimePayload;
		response: WatchtimeResponse | null;
	};
	getPaginatedWatchtime: {
		payload: GetPaginatedWatchtimePayload;
		response: PaginatedWatchtimeResponse;
	};
	getSettings: {
		payload: GetSettingsPayload;
		response: GetSettingsResponse;
	};
	updateSettings: {
		payload: UpdateSettingsPayload;
		response: UpdateSettingsResponse;
	};
	getGlobalSettings: {
		payload: Record<string, never>;
		response: GlobalSettings;
	};
	updateGlobalSettings: {
		payload: UpdateGlobalSettingsPayload;
		response: GlobalSettings;
	};
	initializeEnhancerApi: {
		payload: InitializeEnhancerApiPayload;
		response: AggregateSeed;
	};
	joinEnhancerChannel: {
		payload: JoinEnhancerChannelPayload;
		response: { seed: AggregateSeed | null };
	};
	getEnhancerWatchTime: {
		payload: GetEnhancerWatchTimePayload;
		response: EnhancerStreamerWatchTimeData[];
	};
	disconnectEnhancerApi: {
		payload: DisconnectEnhancerApiPayload;
		response: { success: true };
	};
	getEnhancerAccount: {
		payload: never;
		response: EnhancerAccountState;
	};
	getEnhancerAccountCard: {
		payload: GetEnhancerAccountCardPayload;
		response: EnhancerAccountCard;
	};
	loginEnhancerAccount: {
		payload: never;
		response: LoginEnhancerAccountResponse;
	};
	logoutEnhancerAccount: {
		payload: never;
		response: LogoutEnhancerAccountResponse;
	};
	getEnhancerProfile: {
		payload: never;
		response: GetEnhancerProfileResponse;
	};
	getEnhancerBadges: {
		payload: never;
		response: GetEnhancerBadgesResponse;
	};
	saveEnhancerBadgeSlot: {
		payload: SaveEnhancerBadgeSlotPayload;
		response: SaveEnhancerBadgeSlotResponse;
	};
	getEnhancerBilling: {
		payload: never;
		response: GetEnhancerBillingResponse;
	};
	saveEnhancerChatStyle: {
		payload: SaveEnhancerChatStylePayload;
		response: GetEnhancerBillingResponse;
	};
	submitEnhancerNickname: {
		payload: SubmitEnhancerNicknamePayload;
		response: GetEnhancerBillingResponse;
	};
	clearEnhancerNickname: {
		payload: ClearEnhancerNicknamePayload;
		response: GetEnhancerBillingResponse;
	};
	syncFollows: {
		payload: SyncFollowsPayload;
		response: { success: true };
	};
	updateFollow: {
		payload: UpdateFollowPayload;
		response: { success: true };
	};
	clearFollows: {
		payload: ClearFollowsPayload;
		response: { success: true };
	};
	syncKickSession: {
		payload: SyncKickSessionPayload;
		response: { success: true };
	};
	getFollowsStatus: {
		payload: GetFollowsStatusPayload;
		response: CrossPlatformFollowsSnapshot;
	};
	setChannelPinned: {
		payload: SetChannelPinnedPayload;
		response: { success: true };
	};
	getStreamPlaybackUrl: {
		payload: GetStreamPlaybackUrlPayload;
		response: { url: string | null };
	};
	getChannelPins: {
		payload: GetChannelPinsPayload;
		response: ChannelPinsPayload;
	};
	getChannelLinks: {
		payload: Record<string, never>;
		response: ChannelLinksPayload;
	};
	updateChannelLink: {
		payload: UpdateChannelLinkPayload;
		response: ChannelLinksPayload;
	};
	removeChannelLink: {
		payload: RemoveChannelLinkPayload;
		response: ChannelLinksPayload;
	};
}

export type WorkerAction = keyof WorkerApiActions;

export interface SettingsBroadcastPayload {
	platform: PlatformType;
	settings: PlatformSettings;
}

export type WorkerBroadcast =
	| { type: "settings-updated"; payload: SettingsBroadcastPayload }
	| { type: "global-settings-updated"; payload: GlobalSettings }
	| { type: "enhancer-api-updated"; payload: EnhancerApiUpdatedPayload }
	| { type: "enhancer-api-message"; payload: EnhancerApiMessagePayload }
	| { type: "enhancer-api-patch"; payload: EnhancerApiPatchPayload }
	| { type: "cross-platform-follows-updated"; payload: CrossPlatformFollowsSnapshot }
	| { type: "channel-pins-updated"; payload: ChannelPinsPayload }
	| { type: "channel-links-updated"; payload: ChannelLinksPayload }
	| { type: "enhancer-account-updated"; payload: EnhancerAccountBroadcastPayload }
	| { type: "api-environment-changed"; payload: EnhancerApiEnvironment };
