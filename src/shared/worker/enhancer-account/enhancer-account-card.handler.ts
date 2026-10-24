import { buildAccountCard } from "$shared/enhancer-account/account-card.ts";
import type { Logger } from "$shared/logger/logger.ts";
import type { EnhancerAccountService } from "$shared/worker/enhancer-account/enhancer-account.service.ts";
import type { EnhancerProfileService } from "$shared/worker/enhancer-account/enhancer-profile.service.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type {
	EnhancerAccountCard,
	GetEnhancerAccountCardPayload,
} from "$types/shared/worker/enhancer-account-worker.types.ts";

export class EnhancerAccountCardHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly accountService: EnhancerAccountService,
		private readonly profileService: EnhancerProfileService,
	) {
		super(logger);
	}

	async handle(payload?: GetEnhancerAccountCardPayload): Promise<EnhancerAccountCard> {
		const platform = payload?.platform === "kick" ? "kick" : "twitch";
		const account = await this.accountService.getAccount();
		if (!account.loggedIn) return buildAccountCard(account, null, null, platform);
		const [profile, badges] = await Promise.all([this.profileService.getProfile(), this.profileService.getBadges()]);
		return buildAccountCard(
			account,
			profile.kind === "ok" ? profile.data : null,
			badges.kind === "ok" ? badges.data : null,
			platform,
		);
	}
}
