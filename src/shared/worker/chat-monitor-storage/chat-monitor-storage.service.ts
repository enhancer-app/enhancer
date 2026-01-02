import { Logger } from "$shared/logger/logger.ts";
import { ChatMonitorStorageDatabase } from "$shared/worker/chat-monitor-storage/chat-monitor-storage.database.ts";
import type { ChatMonitorStorageData } from "$types/shared/storage/chat-monitor-storage.types.ts";

export class ChatMonitorStorageService {
	private readonly logger = new Logger({ context: "chat-monitor-storage-service" });
	private readonly database = new ChatMonitorStorageDatabase();

	async initialize(): Promise<void> {
		await this.database.initialize();
		this.logger.info("Chat monitor storage service initialized");
	}

	async getData(): Promise<ChatMonitorStorageData> {
		return await this.database.getData();
	}

	async setData(data: ChatMonitorStorageData): Promise<void> {
		await this.database.setData(data);
		this.logger.debug("Updated chat monitor storage data", data);
	}
}
