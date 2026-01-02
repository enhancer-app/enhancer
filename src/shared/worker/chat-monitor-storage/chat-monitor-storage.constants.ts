import type { ChatMonitorChannel } from "$types/shared/chat-monitor/chat-monitor.types.ts";

export const DEFAULT_CHAT_MONITOR_STORAGE = {
	enabled: false,
	channels: [] as ChatMonitorChannel[],
	keywords: [] as string[],
};
