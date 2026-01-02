import { Logger } from "$shared/logger/logger.ts";
import { ChatMonitorStorageService } from "$shared/worker/chat-monitor-storage/chat-monitor-storage.service.ts";
import { ChatMonitorService } from "$shared/worker/chat-monitor/chat-monitor.service.ts";
import { HandlerRegistry } from "$shared/worker/handler.registry.ts";
import { SettingsService } from "$shared/worker/settings/settings-worker.service.ts";
import { WatchtimeService } from "$shared/worker/watchtime/watchtime.service.ts";

export default class WorkerBackground {
	private readonly logger = new Logger({ context: "background" });
	private readonly watchtimeService = new WatchtimeService();
	private readonly settingsService = new SettingsService();
	private readonly chatMonitorStorageService = new ChatMonitorStorageService();
	private currentTabs = new Map<number, { platform: string; channel: string }>();
	private readonly chatMonitorService = new ChatMonitorService((match) => {
		// Send keyword match notification to content scripts
		// Check if user is currently on the page where the keyword was detected (silent ping)
		let isSilentPing = false;
		for (const [tabId, tab] of this.currentTabs.entries()) {
			if (tab.platform === match.platform && tab.channel.toLowerCase() === match.channel.toLowerCase()) {
				isSilentPing = true;
				break;
			}
		}

		chrome.runtime.sendMessage({
			action: "chatMonitorPing",
			payload: { ...match, silent: isSilentPing },
		});
	});
	private readonly handlerRegistry = new HandlerRegistry(
		this.logger,
		this.watchtimeService,
		this.settingsService,
		this.chatMonitorService,
		this.chatMonitorStorageService,
	);

	private isInitialized = false;
	private messageQueue: Array<{
		message: { action: string; payload?: any };
		sendResponse: (response?: any) => void;
	}> = [];

	async start() {
		this.setupMessageListener();
		this.setupTabTracking();

		await Promise.all([
			this.watchtimeService.initialize(),
			this.settingsService.initialize(),
			this.chatMonitorService.initialize(),
			this.chatMonitorStorageService.initialize(),
		]);

		// Initial setup from storage
		await this.updateChatMonitorFromStorage();

		this.isInitialized = true;
		this.logger.info("Background worker started");

		await this.processQueuedMessages();
	}

	private setupTabTracking() {
		// Track active tabs to determine if user is watching a monitored channel
		chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
			if (changeInfo.status === "complete" && tab.url) {
				this.updateTabInfo(tabId, tab.url);
			}
		});

		chrome.tabs.onRemoved.addListener((tabId) => {
			this.currentTabs.delete(tabId);
		});
	}

	private updateTabInfo(tabId: number, url: string) {
		// Parse URL to detect platform and channel
		try {
			const parsedUrl = new URL(url);
			if (parsedUrl.hostname.includes("twitch.tv")) {
				const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
				if (pathParts.length > 0 && pathParts[0] !== "directory" && pathParts[0] !== "videos") {
					this.currentTabs.set(tabId, {
						platform: "twitch",
						channel: pathParts[0],
					});
					return;
				}
			} else if (parsedUrl.hostname.includes("kick.com")) {
				const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
				if (pathParts.length > 0) {
					this.currentTabs.set(tabId, {
						platform: "kick",
						channel: pathParts[0],
					});
					return;
				}
			}
		} catch (error) {
			// Invalid URL, ignore
		}
	}

	async updateChatMonitorFromStorage(): Promise<void> {
		try {
			const storage = await this.chatMonitorStorageService.getData();

			if (storage.enabled && storage.channels.length > 0 && storage.keywords.length > 0) {
				await this.chatMonitorService.start(storage.channels, storage.keywords);
			} else {
				this.chatMonitorService.stop();
			}
		} catch (error) {
			this.logger.error("Failed to update chat monitor from storage:", error);
		}
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
		const result = await handler.handle(payload);

		// After setting chat monitor storage data, update the chat monitor service
		if (action === "setChatMonitorStorageData") {
			await this.updateChatMonitorFromStorage();
		}

		return result;
	}
}

(async () => {
	const backgroundWorker = new WorkerBackground();
	await backgroundWorker.start();
})();
