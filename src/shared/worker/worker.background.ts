import { KICK_DEFAULT_SETTINGS } from "$kick/kick.constants.ts";
import { Logger } from "$shared/logger/logger.ts";
import { EnhancerApiService } from "$shared/worker/enhancer-api/enhancer-api.service.ts";
import { HandlerRegistry } from "$shared/worker/handler.registry.ts";
import { SettingsDatabase } from "$shared/worker/settings/settings.database.ts";
import { WatchtimeAccumulator } from "$shared/worker/watchtime/watchtime.accumulator.ts";
import { WatchtimeDatabase } from "$shared/worker/watchtime/watchtime.database.ts";
import { TWITCH_DEFAULT_SETTINGS } from "$twitch/twitch.constants.ts";
import type { PlatformSettings } from "$types/shared/worker/settings-worker.types.ts";
import type { PlatformType } from "$types/shared/worker/worker.types.ts";

export default class WorkerBackground {
	private readonly logger = new Logger({ context: "background" });

	private readonly settingsDatabase = new SettingsDatabase(
		new Map<PlatformType, PlatformSettings>([
			["twitch", TWITCH_DEFAULT_SETTINGS],
			["kick", KICK_DEFAULT_SETTINGS],
		]),
	);
	private readonly watchtimeDatabase = new WatchtimeDatabase();
	private readonly watchtimeAccumulator = new WatchtimeAccumulator(this.watchtimeDatabase);
	private readonly enhancerApiService = new EnhancerApiService(this.logger);
	private readonly handlerRegistry = new HandlerRegistry(
		this.logger,
		this.settingsDatabase,
		this.watchtimeDatabase,
		this.watchtimeAccumulator,
		this.enhancerApiService,
	);

	private isInitialized = false;
	private messageQueue: Array<{
		message: { action: string; payload?: any };
		sender: chrome.runtime.MessageSender;
		sendResponse: (response?: any) => void;
	}> = [];

	async start() {
		this.setupMessageListener();

		await Promise.all([this.settingsDatabase.initialize(), this.watchtimeDatabase.initialize()]);
		this.watchtimeAccumulator.initialize();
		this.isInitialized = true;
		this.logger.info("Background worker started");

		await this.processQueuedMessages();
	}

	private setupMessageListener() {
		chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
			if (!this.isInitialized) {
				this.messageQueue.push({ message, sender, sendResponse });
				return true;
			}

			this.handleMessage(message, sender)
				.then(sendResponse)
				.catch((error) => {
					this.logger.error("Message handling failed:", error);
					sendResponse({ __enhancerWorkerError: error.message });
				});

			return true;
		});
	}

	private async processQueuedMessages() {
		if (this.messageQueue.length === 0) return;

		this.logger.info(`Processing ${this.messageQueue.length} queued messages`);

		const promises = this.messageQueue.map(async ({ message, sender, sendResponse }) => {
			try {
				const result = await this.handleMessage(message, sender);
				sendResponse(result);
			} catch (error) {
				this.logger.error("Queued message handling failed:", error);
				sendResponse({ __enhancerWorkerError: (error as Error).message });
			}
		});

		await Promise.all(promises);
		this.messageQueue = [];
	}

	private async handleMessage(message: { action: string; payload?: any }, sender: chrome.runtime.MessageSender) {
		const { action, payload } = message;
		if (!this.handlerRegistry.hasHandler(action)) {
			throw new Error(`Unknown action: ${action}`);
		}
		const handler = this.handlerRegistry.getHandler(action);
		return await handler.handle(payload, sender);
	}
}

(async () => {
	const backgroundWorker = new WorkerBackground();
	await backgroundWorker.start();
})();
