import type { ChatMonitorStorageService } from "$shared/worker/chat-monitor-storage/chat-monitor-storage.service.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { ChatMonitorStorageData } from "$types/shared/storage/chat-monitor-storage.types.ts";

export class GetChatMonitorStorageDataHandler extends MessageHandler {
	constructor(
		logger: any,
		private readonly chatMonitorStorageService: ChatMonitorStorageService,
	) {
		super(logger);
	}

	async handle(): Promise<ChatMonitorStorageData> {
		return await this.chatMonitorStorageService.getData();
	}
}
