import type { PlatformType } from "$types/shared/platform.types.ts";
import type { PlatformSettings } from "$types/shared/worker/settings-worker.types.ts";

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
}

export interface WatchtimeRecord {
	id: string;
	platform: PlatformType;
	username: string;
	time: number;
	firstUpdate: number;
	lastUpdate: number;
}

export interface AddWatchtimePayload {
	platform: PlatformType;
	channel: string;
}

export interface ImportWatchtimePayload {
	platform: PlatformType;
	username: string;
	time: number;
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

export type GetSettingsResponse = PlatformSettings;
export type UpdateSettingsResponse = { success: true };

export interface WorkerApiActions {
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
}

export type WorkerAction = keyof WorkerApiActions;
