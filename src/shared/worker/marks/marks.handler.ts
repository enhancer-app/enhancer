import type { Logger } from "$shared/logger/logger.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { MarksService } from "$shared/worker/marks/marks.service.ts";
import type {
	GetChannelMarkPayload,
	GetMarkClaimStatusPayload,
	MarkIdPayload,
	MarksAction,
} from "$types/shared/worker/marks-worker.types.ts";
import type { WorkerApiActions } from "$types/shared/worker/worker.types.ts";

export class MarksHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly service: MarksService,
		private readonly action: MarksAction,
	) {
		super(logger);
	}

	async handle(
		payload: GetChannelMarkPayload | GetMarkClaimStatusPayload | MarkIdPayload,
	): Promise<WorkerApiActions[MarksAction]["response"]> {
		if (this.action === "getChannelMark") {
			const { platform, externalId } = payload as GetChannelMarkPayload;
			return this.service.getChannelMark(platform, externalId);
		}
		if (this.action === "getMarkClaimStatus") {
			const { markId, login } = payload as GetMarkClaimStatusPayload;
			if (!markId || !login) throw new Error("Mark ID and login are required");
			return this.service.getClaimStatus(markId, login);
		}
		const { markId } = payload as MarkIdPayload;
		if (!markId) throw new Error("Mark ID is required");
		if (this.action === "getMarkViewerState") return this.service.getViewerState(markId);
		return this.service.claim(markId);
	}
}
