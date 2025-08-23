import type { PlatformType } from "$types/shared/platform.types.ts";
import type { CommonDatabaseData } from "$types/shared/storage/common-database.types.ts";
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

export interface GetWatchtimePayload {
	platform: PlatformType;
	channel: string;
}

export interface WatchtimeResponse extends WatchtimeRecord {}

export interface GetSettingsPayload {
	platform: PlatformType;
}

export interface UpdateSettingsPayload {
	platform: PlatformType;
	settings: PlatformSettings;
}

export type GetSettingsResponse = PlatformSettings;
export type UpdateSettingsResponse = { success: true };

// @ts-ignore its okay here
// biome-ignore lint/complexity/noBannedTypes: it's okay here
export type GetCommonDataPayload = {};

export interface GetCommonDataResponse {
	data: CommonDatabaseData;
}

export type SetCommonDataPayload = { data: CommonDatabaseData };

export interface SetCommonDataResponse {
	success: true;
}

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
	getWatchtime: {
		payload: GetWatchtimePayload;
		response: WatchtimeResponse | null;
	};
	getSettings: {
		payload: GetSettingsPayload;
		response: GetSettingsResponse;
	};
	updateSettings: {
		payload: UpdateSettingsPayload;
		response: UpdateSettingsResponse;
	};
	getCommonData: {
		payload: GetCommonDataPayload;
		response: GetCommonDataResponse;
	};
	setCommonData: {
		payload: SetCommonDataPayload;
		response: SetCommonDataResponse;
	};
}

export type WorkerAction = keyof WorkerApiActions;
