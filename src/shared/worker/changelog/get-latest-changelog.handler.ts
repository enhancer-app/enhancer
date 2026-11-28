import type { Logger } from "$shared/logger/logger.ts";
import type { ChangelogFeed } from "$shared/worker/changelog/changelog.feed.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { GetLatestChangelogResponse } from "$types/shared/changelog.types.ts";

export class GetLatestChangelogHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly feed: ChangelogFeed,
	) {
		super(logger);
	}

	async handle(): Promise<GetLatestChangelogResponse> {
		return { entry: await this.feed.getLatest() };
	}
}
