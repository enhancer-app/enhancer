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
	private static readonly FRESH_MS = 60_000;
	private refreshing: Promise<void> | null = null;

	constructor(
		logger: Logger,
		private readonly accountService: EnhancerAccountService,
		private readonly profileService: EnhancerProfileService,
		private readonly now: () => number = Date.now,
	) {
		super(logger);
	}

	async handle(payload?: GetEnhancerAccountCardPayload): Promise<EnhancerAccountCard> {
		const platform = payload?.platform === "kick" ? "kick" : "twitch";
		const account = await this.accountService.getAccount();
		if (!account.loggedIn) return buildAccountCard(account, null, null, platform);
		const cached = await this.profileService.getCached();
		if (this.now() - cached.updatedAt > EnhancerAccountCardHandler.FRESH_MS) this.refresh();
		return buildAccountCard(account, cached.profile ?? null, cached.badges ?? null, platform);
	}

	waitForRefresh(): Promise<void> {
		return this.refreshing ?? Promise.resolve();
	}

	private refresh(): void {
		if (this.refreshing) return;
		this.refreshing = (async () => {
			const before = await this.profileService.getCached();
			const [profile, badges] = await Promise.all([this.profileService.getProfile(), this.profileService.getBadges()]);
			const after = await this.profileService.getCached();
			const changed =
				profile.kind === "unauthenticated" ||
				badges.kind === "unauthenticated" ||
				JSON.stringify([before.profile, before.badges]) !== JSON.stringify([after.profile, after.badges]);
			if (changed) await this.accountService.notifyAccountChanged();
		})()
			.catch((error) => this.logger.warn("Enhancer account card refresh failed:", error))
			.finally(() => {
				this.refreshing = null;
			});
	}
}
