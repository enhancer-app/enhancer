import { KICK_DEFAULT_SETTINGS } from "$kick/kick.constants.ts";
import { Logger } from "$shared/logger/logger.ts";
import { CredentialDatabase } from "$shared/worker/credentials/credential.database.ts";
import { getRequiredScopes } from "$shared/worker/credentials/credential.scopes.ts";
import { CredentialVault } from "$shared/worker/credentials/credential.vault.ts";
import { SharedDatabase } from "$shared/worker/database/shared.database.ts";
import { CrossPlatformFollowsRefresher } from "$shared/worker/cross-platform-follows/cross-platform-follows.refresher.ts";
import { ENHANCER_ENDPOINTS, resolveApiEnvironment } from "$shared/enhancer-environment.ts";
import { isActionAllowedFrom } from "$shared/worker/enhancer-account/account-access.ts";
import { EnhancerAccountDatabase } from "$shared/worker/enhancer-account/enhancer-account.database.ts";
import { EnhancerAccountService } from "$shared/worker/enhancer-account/enhancer-account.service.ts";
import { EnhancerProfileService } from "$shared/worker/enhancer-account/enhancer-profile.service.ts";
import { AggregateSnapshotDatabase } from "$shared/worker/enhancer-api/aggregate-snapshot.database.ts";
import { EnhancerApiService } from "$shared/worker/enhancer-api/enhancer-api.service.ts";
import { HandlerRegistry } from "$shared/worker/handler.registry.ts";
import { SettingsDatabase } from "$shared/worker/settings/settings.database.ts";
import { WatchtimeAccumulator } from "$shared/worker/watchtime/watchtime.accumulator.ts";
import { WatchtimeDatabase } from "$shared/worker/watchtime/watchtime.database.ts";
import { TWITCH_DEFAULT_SETTINGS } from "$twitch/twitch.constants.ts";
import type { EnhancerApiEnvironment } from "$types/shared/enhancer-environment.types.ts";
import type { GlobalSettings } from "$types/shared/settings/global-settings.types.ts";
import type { PlatformSettings } from "$types/shared/worker/settings-worker.types.ts";
import type { PlatformType, WorkerBroadcast } from "$types/shared/worker/worker.types.ts";

export default class WorkerBackground {
	private readonly logger = new Logger({ context: "background", source: "background" });
	private readonly enhancerApiLogger = new Logger({ context: "enhancer-api-worker", source: "background" });

	private readonly settingsDatabase = new SettingsDatabase(
		new Map<PlatformType, PlatformSettings>([
			["twitch", TWITCH_DEFAULT_SETTINGS],
			["kick", KICK_DEFAULT_SETTINGS],
		]),
	);
	private readonly watchtimeDatabase = new WatchtimeDatabase();
	private readonly watchtimeAccumulator = new WatchtimeAccumulator(this.watchtimeDatabase);
	private readonly aggregateSnapshotDatabase = new AggregateSnapshotDatabase();
	private readonly enhancerApiService = new EnhancerApiService(
		this.enhancerApiLogger,
		__version__,
		this.aggregateSnapshotDatabase,
	);
	private readonly sharedDatabase = new SharedDatabase();
	private readonly credentialDatabase = new CredentialDatabase();
	private readonly credentialVault = new CredentialVault(this.credentialDatabase);
	private readonly crossPlatformFollowsRefresher = new CrossPlatformFollowsRefresher(
		this.logger,
		this.sharedDatabase,
		this.watchtimeDatabase,
		this.credentialVault,
	);
	private readonly enhancerAccountDatabase = new EnhancerAccountDatabase();
	private readonly enhancerAccountService = new EnhancerAccountService(
		new Logger({ context: "enhancer-account", source: "background" }),
		this.enhancerAccountDatabase,
	);
	private readonly enhancerProfileService = new EnhancerProfileService(
		new Logger({ context: "enhancer-profile", source: "background" }),
		this.enhancerAccountService,
	);
	private readonly handlerRegistry = new HandlerRegistry(
		this.logger,
		this.settingsDatabase,
		this.watchtimeDatabase,
		this.watchtimeAccumulator,
		this.enhancerApiService,
		this.sharedDatabase,
		this.crossPlatformFollowsRefresher,
		this.credentialVault,
		this.enhancerAccountService,
		this.enhancerProfileService,
		(settings) => this.switchApiEnvironment(settings, true),
	);

	private apiEnvironment: EnhancerApiEnvironment = "production";
	private isInitialized = false;
	private messageQueue: Array<{
		message: { action: string; payload?: any };
		sender: chrome.runtime.MessageSender;
		sendResponse: (response?: any) => void;
	}> = [];

	async start() {
		this.setupMessageListener();

		await Promise.all([
			this.settingsDatabase.initialize(),
			this.watchtimeDatabase.initialize(),
			this.sharedDatabase.initialize().catch((error) => this.logger.error("Shared database unavailable:", error)),
			this.aggregateSnapshotDatabase
				.initialize()
				.catch((error) => this.logger.error("Aggregate database unavailable:", error)),
			this.credentialDatabase
				.initialize()
				.catch((error) => this.logger.error("Credential database unavailable:", error)),
			this.enhancerAccountDatabase
				.initialize()
				.catch((error) => this.logger.error("Account database unavailable:", error)),
		]);
		await this.settingsDatabase
			.getGlobalSettings()
			.then(async (settings) => {
				await this.switchApiEnvironment(settings, false);
				await this.credentialVault.syncGrants(getRequiredScopes(settings));
			})
			.catch((error) => this.logger.error("Failed to apply global settings:", error));
		this.watchtimeAccumulator.initialize();
		this.isInitialized = true;
		this.logger.info("Background worker started");

		await this.processQueuedMessages();
	}

	private async switchApiEnvironment(settings: GlobalSettings, reloadTabs: boolean): Promise<void> {
		const environment = resolveApiEnvironment(settings);
		if (environment === this.apiEnvironment) return;
		this.apiEnvironment = environment;
		this.logger.info(`Using the ${environment} Enhancer API`);
		this.enhancerApiService.setEndpoints(ENHANCER_ENDPOINTS[environment]);
		await this.enhancerAccountService.setEnvironment(environment);
		if (!reloadTabs) return;
		await this.aggregateSnapshotDatabase
			.clear()
			.catch((error) => this.logger.warn("Failed to clear stored aggregates:", error));
		const broadcast: WorkerBroadcast = { type: "api-environment-changed", payload: environment };
		const tabs = await chrome.tabs.query({});
		setTimeout(() => {
			for (const tab of tabs) if (tab.id) chrome.tabs.sendMessage(tab.id, broadcast).catch(() => {});
		}, 500);
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
		if (!isActionAllowedFrom(action, sender.url, chrome.runtime.getURL(""))) {
			throw new Error(`${action} is only available on Enhancer pages`);
		}
		const handler = this.handlerRegistry.getHandler(action);
		return await handler.handle(payload, sender);
	}
}

(async () => {
	const backgroundWorker = new WorkerBackground();
	await backgroundWorker.start();
})();
