import type { Logger } from "$shared/logger/logger.ts";
import type { EnhancerApiService } from "$shared/worker/enhancer-api/enhancer-api.service.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type {
	DisconnectEnhancerApiPayload,
	EnhancerApiAction,
	GetEnhancerWatchTimePayload,
	InitializeEnhancerApiPayload,
	JoinEnhancerChannelPayload,
} from "$types/shared/worker/enhancer-api-worker.types.ts";
import type { WorkerApiActions } from "$types/shared/worker/worker.types.ts";

export class EnhancerApiHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly service: EnhancerApiService,
		private readonly action: EnhancerApiAction,
	) {
		super(logger);
	}

	async handle(
		payload:
			| InitializeEnhancerApiPayload
			| JoinEnhancerChannelPayload
			| GetEnhancerWatchTimePayload
			| DisconnectEnhancerApiPayload,
		sender?: chrome.runtime.MessageSender,
	): Promise<WorkerApiActions[EnhancerApiAction]["response"]> {
		if (this.action === "getEnhancerWatchTime") {
			const { username, period, platform } = payload as GetEnhancerWatchTimePayload;
			return this.service.getWatchTime(username, period, platform);
		}
		if (sender?.tab?.id == null) throw new Error("Enhancer API requests require a browser tab");
		if (this.action === "disconnectEnhancerApi") {
			const { platform, clientId } = payload as DisconnectEnhancerApiPayload;
			this.service.disconnect(sender.tab.id, sender.frameId ?? 0, clientId, platform);
			return { success: true };
		}
		if (this.action === "initializeEnhancerApi") {
			const { platform, clientId, seed } = payload as InitializeEnhancerApiPayload;
			return this.service.initialize(sender.tab.id, sender.frameId ?? 0, clientId, platform, seed);
		}
		const { platform, externalId, clientId, seed } = payload as JoinEnhancerChannelPayload;
		return {
			seed: await this.service.joinChannel(sender.tab.id, sender.frameId ?? 0, clientId, platform, externalId, seed),
		};
	}
}
