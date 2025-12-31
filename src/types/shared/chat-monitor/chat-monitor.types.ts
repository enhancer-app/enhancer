import type { PlatformType } from "$types/shared/platform.types.ts";

export interface ChatMonitorChannel {
	platform: PlatformType;
	channel: string;
}

export interface ChatMonitorKeywordMatch {
	platform: PlatformType;
	channel: string;
	username: string;
	message: string;
	keyword: string;
	timestamp: number;
}

export interface ChatMonitorSettings {
	enabled: boolean;
	channels: ChatMonitorChannel[];
	keywords: string[];
}
