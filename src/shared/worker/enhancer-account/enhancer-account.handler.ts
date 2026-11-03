import type { Logger } from "$shared/logger/logger.ts";
import type { EnhancerAccountService } from "$shared/worker/enhancer-account/enhancer-account.service.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { EnhancerAccountAction } from "$types/shared/worker/enhancer-account-worker.types.ts";
import type { WorkerApiActions } from "$types/shared/worker/worker.types.ts";

export class EnhancerAccountHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly service: EnhancerAccountService,
		private readonly action: EnhancerAccountAction,
	) {
		super(logger);
	}

	async handle(): Promise<WorkerApiActions[EnhancerAccountAction]["response"]> {
		if (this.action === "loginEnhancerAccount") return this.service.login();
		if (this.action === "logoutEnhancerAccount") {
			await this.service.logout();
			return { success: true };
		}
		return this.service.getAccount();
	}
}
