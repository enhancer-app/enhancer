import type { Logger } from "$shared/logger/logger.ts";
import type { EnhancerApiService } from "$shared/worker/enhancer-api/enhancer-api.service.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type {
	DisconnectEnhancerApiPayload,
	GetEnhancerWatchTimePayload,
	InitializeEnhancerApiPayload,
	JoinEnhancerChannelPayload,
} from "$types/shared/worker/enhancer-api-worker.types.ts";
import type { WorkerApiActions } from "$types/shared/worker/worker.types.ts";

abstract class EnhancerApiHandler extends MessageHandler {
	constructor(
		logger: Logger,
		protected readonly service: EnhancerApiService,
	) {
		super(logger);
	}

	protected requireTabId(sender?: chrome.runtime.MessageSender): number {
		if (sender?.tab?.id == null) throw new Error("Enhancer API requests require a browser tab");

		return sender.tab.id;
	}
}

export class GetEnhancerWatchTimeHandler extends EnhancerApiHandler {
	async handle({
		username,
		period,
		platform,
	}: GetEnhancerWatchTimePayload): Promise<WorkerApiActions["getEnhancerWatchTime"]["response"]> {
		return this.service.getWatchTime(username, period, platform);
	}
}

export class DisconnectEnhancerApiHandler extends EnhancerApiHandler {
	async handle(
		payload: DisconnectEnhancerApiPayload,
		sender?: chrome.runtime.MessageSender,
	): Promise<WorkerApiActions["disconnectEnhancerApi"]["response"]> {
		const tabId = this.requireTabId(sender);
		const { platform, clientId } = payload;
		this.service.disconnect(tabId, sender?.frameId ?? 0, clientId, platform);

		return { success: true };
	}
}

export class InitializeEnhancerApiHandler extends EnhancerApiHandler {
	async handle(
		payload: InitializeEnhancerApiPayload,
		sender?: chrome.runtime.MessageSender,
	): Promise<WorkerApiActions["initializeEnhancerApi"]["response"]> {
		const tabId = this.requireTabId(sender);
		const { platform, clientId, seed } = payload;

		return this.service.initialize(tabId, sender?.frameId ?? 0, clientId, platform, seed);
	}
}

export class JoinEnhancerChannelHandler extends EnhancerApiHandler {
	async handle(
		payload: JoinEnhancerChannelPayload,
		sender?: chrome.runtime.MessageSender,
	): Promise<WorkerApiActions["joinEnhancerChannel"]["response"]> {
		const tabId = this.requireTabId(sender);
		const { platform, externalId, clientId, seed } = payload;

		return {
			seed: await this.service.joinChannel(tabId, sender?.frameId ?? 0, clientId, platform, externalId, seed),
		};
	}
}
