import type { ChatMonitorChannel } from "$types/shared/chat-monitor/chat-monitor.types.ts";

export type ChatMonitorStorageData = {
	enabled: boolean;
	channels: ChatMonitorChannel[];
	keywords: string[];
};
