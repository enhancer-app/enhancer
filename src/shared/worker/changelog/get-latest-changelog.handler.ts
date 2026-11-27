import type { Logger } from "$shared/logger/logger.ts";
import type { ChangelogFeed } from "$shared/worker/changelog/changelog.feed.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { GetLatestChangelogResponse } from "$types/shared/changelog.types.ts";
import type { ExtensionChannel } from "$types/shared/extension.types.ts";

export class GetLatestChangelogHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly feed: ChangelogFeed,
		private readonly channel: ExtensionChannel,
	) {
		super(logger);
	}

	async handle(): Promise<GetLatestChangelogResponse> {
		if (this.channel === "canary") return { entry: null };
		return { entry: await this.feed.getLatest() };
	}
}
