import type { Logger } from "$shared/logger/logger.ts";
import type { EnhancerProfileService } from "$shared/worker/enhancer-account/enhancer-profile.service.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type {
	EnhancerProfileAction,
	SaveEnhancerBadgeSlotPayload,
} from "$types/shared/worker/enhancer-account-worker.types.ts";
import type { WorkerApiActions } from "$types/shared/worker/worker.types.ts";

export class EnhancerProfileHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly service: EnhancerProfileService,
		private readonly action: EnhancerProfileAction,
	) {
		super(logger);
	}

	async handle(payload?: SaveEnhancerBadgeSlotPayload): Promise<WorkerApiActions[EnhancerProfileAction]["response"]> {
		if (this.action === "getEnhancerProfile") return this.service.getProfile();
		if (this.action === "getEnhancerBadges") return this.service.getBadges();
		if (!payload || !Array.isArray(payload.visibleAssignmentIds)) throw new Error("Badge slot payload is required");
		return this.service.saveBadgeSlot(payload);
	}
}
