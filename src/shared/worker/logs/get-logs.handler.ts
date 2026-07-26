import { Logger } from "$shared/logger/logger.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { LogEntry } from "$types/shared/logger.types.ts";

export class GetLogsHandler extends MessageHandler {
	async handle(): Promise<LogEntry[]> {
		return Logger.getLogs();
	}
}
