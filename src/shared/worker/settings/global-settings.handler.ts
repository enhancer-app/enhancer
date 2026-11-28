import type { Logger } from "$shared/logger/logger.ts";
import { getRequiredScopes } from "$shared/worker/credentials/credential.scopes.ts";
import type { CredentialVault } from "$shared/worker/credentials/credential.vault.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { SettingsDatabase } from "$shared/worker/settings/settings.database.ts";
import type { GlobalSettings } from "$types/shared/settings/global-settings.types.ts";
import type { UpdateGlobalSettingsPayload, WorkerBroadcast } from "$types/shared/worker/worker.types.ts";

export class GetGlobalSettingsHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly database: SettingsDatabase,
	) {
		super(logger);
	}

	async handle(): Promise<GlobalSettings> {
		return this.database.getGlobalSettings();
	}
}

export class UpdateGlobalSettingsHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly database: SettingsDatabase,
		private readonly vault: CredentialVault,
		private readonly onFollowsSharingDisabled: () => Promise<unknown>,
		private readonly onApiEnvironmentChanged: (settings: GlobalSettings) => Promise<unknown> = async () => {},
	) {
		super(logger);
	}

	async handle(payload: UpdateGlobalSettingsPayload): Promise<GlobalSettings> {
		if (!payload || typeof payload.settings !== "object" || payload.settings === null) {
			throw new Error("Invalid payload for updateGlobalSettings action. 'settings' is required.");
		}

		const previous = await this.database.getGlobalSettings();
		const settings = await this.database.updateGlobalSettings(payload.settings);
		await this.vault.syncGrants(getRequiredScopes(settings));
		await this.broadcast(settings);

		if (previous.crossPlatformFollowsSyncEnabled && !settings.crossPlatformFollowsSyncEnabled) {
			await this.onFollowsSharingDisabled();
		}
		if (
			previous.apiEnvironment !== settings.apiEnvironment ||
			previous.developerSettingsEnabled !== settings.developerSettingsEnabled
		) {
			await this.onApiEnvironmentChanged(settings);
		}
		return settings;
	}

	private async broadcast(settings: GlobalSettings): Promise<void> {
		const broadcast: WorkerBroadcast = { type: "global-settings-updated", payload: settings };
		chrome.runtime.sendMessage(broadcast).catch(() => {});
		for (const tab of await chrome.tabs.query({})) {
			if (tab.id) chrome.tabs.sendMessage(tab.id, broadcast).catch(() => {});
		}
	}
}
