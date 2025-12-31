import type { ChatMonitorKeywordMatch } from "$types/shared/chat-monitor/chat-monitor.types.ts";

export type CommonEvents = {
	"extension:start": () => void | Promise<void>;
	"extension:settings-open": () => void | Promise<void>;
	"extension:settings-refresh": () => void | Promise<void>;
	"extension:watchtime-refresh": () => void | Promise<void>;
	"extension:chat-monitor-ping": (match: ChatMonitorKeywordMatch) => void | Promise<void>;
	"extension:chat-monitor-open": () => void | Promise<void>;
};
