import type { Logger } from "$shared/logger/logger.ts";
import type { CredentialVault } from "$shared/worker/credentials/credential.vault.ts";
import { fetchKickAccountId } from "$shared/worker/cross-platform-follows/cross-platform-follows.fetchers.ts";
import type { CrossPlatformFollowsRefresher } from "$shared/worker/cross-platform-follows/cross-platform-follows.refresher.ts";
import type { SharedDatabase } from "$shared/worker/database/shared.database.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { SyncKickSessionPayload } from "$types/shared/worker/cross-platform-follows-worker.types.ts";

export class SyncKickSessionHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly vault: CredentialVault,
		private readonly database: SharedDatabase,
		private readonly refresher: CrossPlatformFollowsRefresher,
	) {
		super(logger);
	}

	async handle(payload: SyncKickSessionPayload): Promise<{ success: true }> {
		const token = typeof payload?.token === "string" && payload.token ? payload.token : null;
		const result = await this.vault.save("kick", token);

		if (result === "removed") {
			this.logger.info("Kick session ended, removed saved login and follows");
			await this.clearFollows();
		}
		if (result !== "saved") return { success: true };

		const previousAccountId = await this.vault.getAccountId("kick");
		const accountId = await fetchKickAccountId(this.vault);
		if (accountId) {
			if (previousAccountId && previousAccountId !== accountId) {
				this.logger.info("Kick account changed, clearing follows");
				await this.clearFollows();
			}
			await this.vault.setAccountId("kick", accountId);
		}

		this.refresher.resetKickFollowsRetry();
		await this.refresher.refreshIfStale("kick", true);
		return { success: true };
	}

	private async clearFollows(): Promise<void> {
		if (await this.database.clear("kick")) await this.refresher.broadcast("kick");
	}
}
