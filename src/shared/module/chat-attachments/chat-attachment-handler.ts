import type { Logger } from "$shared/logger/logger.ts";
import type {
	BaseChatAttachmentData,
	ChatAttachmentData,
} from "$types/shared/module/chat-attachment/chat-attachment.types.ts";

export default abstract class ChatAttachmentHandler {
	constructor(protected readonly logger: Logger) {}

	abstract validate(baseData: BaseChatAttachmentData): boolean;

	async applies(_data: ChatAttachmentData): Promise<boolean> {
		throw new Error("Not implemented");
	}

	async handle(_data: ChatAttachmentData) {
		throw new Error("Not implemented");
	}

	parseUrl(_url: URL): URL {
		throw new Error("Not implemented");
	}
}
