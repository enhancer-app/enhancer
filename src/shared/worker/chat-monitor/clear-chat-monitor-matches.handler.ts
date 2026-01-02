import type { Logger } from "$shared/logger/logger.ts";
import type { ChatMonitorService } from "$shared/worker/chat-monitor/chat-monitor.service.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { ClearChatMonitorMatchesResponse } from "$types/shared/worker/worker.types.ts";

export class ClearChatMonitorMatchesHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly chatMonitorService: ChatMonitorService,
	) {
		super(logger);
	}

	async handle(): Promise<ClearChatMonitorMatchesResponse> {
		this.chatMonitorService.clearMatches();
		return { success: true };
	}
}
