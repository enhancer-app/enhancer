import { KICK_DEFAULT_SETTINGS } from "$kick/kick.constants.ts";
import { Logger } from "$shared/logger/logger.ts";
import { HandlerRegistry } from "$shared/worker/handler.registry.ts";
import { SettingsDatabase } from "$shared/worker/settings/settings.database.ts";
import { SharedDataDatabase } from "$shared/worker/shared-data/shared-data.database.ts";
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
	private readonly sharedDataDatabase = new SharedDataDatabase();
	private readonly watchtimeDatabase = new WatchtimeDatabase();
	private readonly watchtimeAccumulator = new WatchtimeAccumulator(this.watchtimeDatabase);
	private readonly handlerRegistry = new HandlerRegistry(
		this.logger,
		this.settingsDatabase,
		this.sharedDataDatabase,
		this.watchtimeDatabase,
		this.watchtimeAccumulator,
	);

	private isInitialized = false;
	private messageQueue: Array<{
		message: { action: string; payload?: any };
		sendResponse: (response?: any) => void;
	}> = [];

	async start() {
		this.setupMessageListener();

		await Promise.all([
			this.settingsDatabase.initialize(),
			this.sharedDataDatabase.initialize(),
			this.watchtimeDatabase.initialize(),
		]);
		this.watchtimeAccumulator.initialize();
		this.isInitialized = true;
		this.logger.info("Background worker started");

		await this.processQueuedMessages();
	}

	private setupMessageListener() {
		chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
