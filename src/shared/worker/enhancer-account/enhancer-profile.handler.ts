import type { Logger } from "$shared/logger/logger.ts";
import type { EnhancerProfileService } from "$shared/worker/enhancer-account/enhancer-profile.service.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type {
	ClearEnhancerNicknamePayload,
	EnhancerProfileAction,
	EnhancerProfilePayload,
	SaveEnhancerBadgeSlotPayload,
	SaveEnhancerChatStylePayload,
	SubmitEnhancerNicknamePayload,
} from "$types/shared/worker/enhancer-account-worker.types.ts";
import type { WorkerApiActions } from "$types/shared/worker/worker.types.ts";

function isAccountId(value: unknown): value is string {
	return typeof value === "string" && value.length > 0 && value.length <= 64;
}

function isFontName(value: unknown): value is string | null | undefined {
	return value == null || (typeof value === "string" && value.length <= 100);
}

export class EnhancerProfileHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly service: EnhancerProfileService,
		private readonly action: EnhancerProfileAction,
	) {
		super(logger);
	}

	async handle(payload?: EnhancerProfilePayload): Promise<WorkerApiActions[EnhancerProfileAction]["response"]> {
		switch (this.action) {
			case "getEnhancerProfile":
				return this.service.getProfile();
			case "getEnhancerBadges":
				return this.service.getBadges();
			case "getEnhancerBilling":
				return this.service.getBilling();
			case "saveEnhancerBadgeSlot": {
				const slot = payload as SaveEnhancerBadgeSlotPayload | undefined;
				if (!slot || !Array.isArray(slot.visibleAssignmentIds)) throw new Error("Badge slot payload is required");
				return this.service.saveBadgeSlot(slot);
			}
			case "saveEnhancerChatStyle": {
				const style = payload as SaveEnhancerChatStylePayload | undefined;
				if (!isAccountId(style?.accountId) || typeof style.hasGlow !== "boolean" || !isFontName(style.customFont)) {
					throw new Error("Chat style payload is required");
				}
				return this.service.saveChatStyle({
					accountId: style.accountId,
					hasGlow: style.hasGlow,
					customFont: style.customFont ?? null,
				});
			}
			case "submitEnhancerNickname": {
				const nickname = payload as SubmitEnhancerNicknamePayload | undefined;
				if (
					!isAccountId(nickname?.accountId) ||
					typeof nickname.nickname !== "string" ||
					nickname.nickname.length > 512
				) {
					throw new Error("Nickname payload is required");
				}
				return this.service.submitNickname({ accountId: nickname.accountId, nickname: nickname.nickname });
			}
			case "clearEnhancerNickname": {
				const target = payload as ClearEnhancerNicknamePayload | undefined;
				if (!isAccountId(target?.accountId)) throw new Error("Account id is required");
				return this.service.clearNickname(target.accountId);
			}
		}
	}
}
