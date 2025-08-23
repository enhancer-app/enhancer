import { Logger } from "$shared/logger/logger.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";

export default class FollowSyncer {
	protected readonly logger: Logger;

	constructor(private readonly platform: PlatformType) {
		this.logger = new Logger({ context: `${platform}-follow-syncer` });
	}

	async getFollows() {
		throw new Error("Not implemented");
	}

	async clearFollows() {
		throw new Error("Not implemented");
	}
}
