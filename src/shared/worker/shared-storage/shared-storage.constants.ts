import { DEFAULT_CHAT_MONITOR_STORAGE } from "$shared/worker/chat-monitor-storage/chat-monitor-storage.constants.ts";
import type { SharedStorageData } from "$types/shared/storage/shared-storage.types.ts";

export const DEFAULT_SHARED_STORAGE: SharedStorageData = {
	chatMonitor: DEFAULT_CHAT_MONITOR_STORAGE,
};
