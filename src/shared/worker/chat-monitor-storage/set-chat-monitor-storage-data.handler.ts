import type { ChatMonitorStorageService } from "$shared/worker/chat-monitor-storage/chat-monitor-storage.service.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { ChatMonitorStorageData } from "$types/shared/storage/chat-monitor-storage.types.ts";

export interface SetChatMonitorStorageDataPayload {
	data: ChatMonitorStorageData;
}

export interface SetChatMonitorStorageDataResponse {
	success: true;
}

export class SetChatMonitorStorageDataHandler extends MessageHandler {
	constructor(
		logger: any,
		private readonly chatMonitorStorageService: ChatMonitorStorageService,
	) {
		super(logger);
	}

	async handle(payload: SetChatMonitorStorageDataPayload): Promise<SetChatMonitorStorageDataResponse> {
		await this.chatMonitorStorageService.setData(payload.data);
		return { success: true };
	}
}
