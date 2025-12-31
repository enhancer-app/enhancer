import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { ChatMonitorService } from "$shared/worker/chat-monitor/chat-monitor.service.ts";
import type {
	GetChatMonitorMatchesPayload,
	GetChatMonitorMatchesResponse,
} from "$types/shared/worker/worker.types.ts";

export class GetChatMonitorMatchesHandler extends MessageHandler {
	constructor(
		logger: any,
		private readonly chatMonitorService: ChatMonitorService,
	) {
		super(logger);
	}

	async handle(payload: GetChatMonitorMatchesPayload): Promise<GetChatMonitorMatchesResponse> {
		const limit = payload?.limit || 20;
		const matches = this.chatMonitorService.getRecentMatches(limit);
		return { matches };
	}
}
