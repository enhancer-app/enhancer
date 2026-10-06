import type { Logger } from "$shared/logger/logger.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { MomentsService } from "$shared/worker/moments/moments.service.ts";
import type {
	GetChannelMomentPayload,
	GetMomentClaimStatusPayload,
	MomentIdPayload,
	MomentsAction,
} from "$types/shared/worker/moments-worker.types.ts";
import type { WorkerApiActions } from "$types/shared/worker/worker.types.ts";

export class MomentsHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly service: MomentsService,
		private readonly action: MomentsAction,
	) {
		super(logger);
	}

	async handle(
		payload: GetChannelMomentPayload | GetMomentClaimStatusPayload | MomentIdPayload,
	): Promise<WorkerApiActions[MomentsAction]["response"]> {
		if (this.action === "getChannelMoment") {
			const { platform, externalId } = payload as GetChannelMomentPayload;
			return this.service.getChannelMoment(platform, externalId);
		}
		if (this.action === "getMomentClaimStatus") {
			const { momentId, login } = payload as GetMomentClaimStatusPayload;
			if (!momentId || !login) throw new Error("Moment ID and login are required");
			return this.service.getClaimStatus(momentId, login);
		}
		const { momentId } = payload as MomentIdPayload;
		if (!momentId) throw new Error("Moment ID is required");
		if (this.action === "getMomentViewerState") return this.service.getViewerState(momentId);
		return this.service.claim(momentId);
	}
}
