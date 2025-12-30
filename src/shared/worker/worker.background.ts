import { Logger } from "$shared/logger/logger.ts";
import { HandlerRegistry } from "$shared/worker/handler.registry.ts";
import { SettingsService } from "$shared/worker/settings/settings-worker.service.ts";
import { SharedStorageService } from "$shared/worker/shared-storage/shared-storage.service.ts";
import { StreamerStatusManager } from "$shared/worker/streamer-status/streamer-status.manager.ts";
import { WatchtimeService } from "$shared/worker/watchtime/watchtime.service.ts";

export default class WorkerBackground {
	private readonly logger = new Logger({ context: "background" });
	private readonly watchtimeService = new WatchtimeService();
	private readonly settingsService = new SettingsService();
	private readonly sharedStorageService = new SharedStorageService();
	private readonly streamerStatusManager = new StreamerStatusManager();
	private readonly handlerRegistry = new HandlerRegistry(
		this.logger,
		this.watchtimeService,
		this.settingsService,
		this.sharedStorageService,
	);

	private isInitialized = false;
	private messageQueue: Array<{
		message: { action: string; payload?: any };
		sendResponse: (response?: any) => void;
	}> = [];

	async start() {
		this.setupMessageListener();

		await Promise.all([
			this.watchtimeService.initialize(),
			this.settingsService.initialize(),
			this.sharedStorageService.initialize(),
		]);

		// Start background manager for streamer status refresh
		this.streamerStatusManager.start();

		this.isInitialized = true;
		this.logger.info("Background worker started");

		await this.processQueuedMessages();
	}

	private setupMessageListener() {
		chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
			if (!this.isInitialized) {
				this.messageQueue.push({ message, sendResponse });
				return true;
			}

			this.handleMessage(message)
				.then(sendResponse)
				.catch((error) => {
					this.logger.error("Message handling failed:", error);
					sendResponse({ error: error.message });
				});

			return true;
		});
	}

	private async processQueuedMessages() {
		if (this.messageQueue.length === 0) return;

		this.logger.info(`Processing ${this.messageQueue.length} queued messages`);

		const promises = this.messageQueue.map(async ({ message, sendResponse }) => {
			try {
				const result = await this.handleMessage(message);
				sendResponse(result);
			} catch (error) {
				this.logger.error("Queued message handling failed:", error);
				sendResponse({ error: (error as Error).message });
			}
		});

		await Promise.all(promises);
		this.messageQueue = [];
	}

	private async handleMessage(message: { action: string; payload?: any }) {
		const { action, payload } = message;
		if (!this.handlerRegistry.hasHandler(action)) {
			throw new Error(`Unknown action: ${action}`);
		}
		const handler = this.handlerRegistry.getHandler(action);
		return await handler.handle(payload);
	}
}

(async () => {
	const backgroundWorker = new WorkerBackground();
	await backgroundWorker.start();
})();
