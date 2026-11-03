import type { Logger } from "$shared/logger/logger.ts";
import type { CredentialVault } from "$shared/worker/credentials/credential.vault.ts";
import { ClearFollowsHandler } from "$shared/worker/cross-platform-follows/clear-follows.handler.ts";
import type { SharedDatabase } from "$shared/worker/database/shared.database.ts";
import type { CrossPlatformFollowsRefresher } from "$shared/worker/cross-platform-follows/cross-platform-follows.refresher.ts";
import { GetFollowsStatusHandler } from "$shared/worker/cross-platform-follows/get-follows-status.handler.ts";
import { GetStreamPlaybackUrlHandler } from "$shared/worker/cross-platform-follows/get-stream-playback-url.handler.ts";
import { GetChannelPinsHandler, SetChannelPinnedHandler } from "$shared/worker/pins/channel-pins.handler.ts";
import {
	GetChannelLinksHandler,
	RemoveChannelLinkHandler,
	UpdateChannelLinkHandler,
} from "$shared/worker/links/channel-links.handler.ts";
import { SyncFollowsHandler } from "$shared/worker/cross-platform-follows/sync-follows.handler.ts";
import { SyncKickSessionHandler } from "$shared/worker/cross-platform-follows/sync-kick-session.handler.ts";
import { UpdateFollowHandler } from "$shared/worker/cross-platform-follows/update-follow.handler.ts";
import { EnhancerAccountCardHandler } from "$shared/worker/enhancer-account/enhancer-account-card.handler.ts";
import { EnhancerAccountHandler } from "$shared/worker/enhancer-account/enhancer-account.handler.ts";
import type { EnhancerAccountService } from "$shared/worker/enhancer-account/enhancer-account.service.ts";
import { EnhancerProfileHandler } from "$shared/worker/enhancer-account/enhancer-profile.handler.ts";
import type { EnhancerProfileService } from "$shared/worker/enhancer-account/enhancer-profile.service.ts";
import { EnhancerApiHandler } from "$shared/worker/enhancer-api/enhancer-api.handler.ts";
import type { EnhancerApiService } from "$shared/worker/enhancer-api/enhancer-api.service.ts";
import { AssetsFileHandler } from "$shared/worker/file/assets-file.handler.ts";
import { GetLogsHandler } from "$shared/worker/logs/get-logs.handler.ts";
import type { MessageHandler } from "$shared/worker/message.handler.ts";
import { PingHandler } from "$shared/worker/ping/ping.handler.ts";
import {
	GetGlobalSettingsHandler,
	UpdateGlobalSettingsHandler,
} from "$shared/worker/settings/global-settings.handler.ts";
import { GetSettingsHandler } from "$shared/worker/settings/get-settings.handler.ts";
import type { SettingsDatabase } from "$shared/worker/settings/settings.database.ts";
import { UpdateSettingsHandler } from "$shared/worker/settings/update-settings.handler.ts";
import { AddWatchtimeHandler } from "$shared/worker/watchtime/add-watchtime.handler.ts";
import { GetPaginatedWatchtimeHandler } from "$shared/worker/watchtime/get-paginated-watchtime.handler.ts";
import { GetWatchtimeHandler } from "$shared/worker/watchtime/get-watchtime.handler.ts";
import { ImportWatchtimeHandler } from "$shared/worker/watchtime/import-watchtime.handler.ts";
import type { WatchtimeAccumulator } from "$shared/worker/watchtime/watchtime.accumulator.ts";
import type { WatchtimeDatabase } from "$shared/worker/watchtime/watchtime.database.ts";
import type { GlobalSettings } from "$types/shared/settings/global-settings.types.ts";
import type { WorkerAction } from "$types/shared/worker/worker.types.ts";

export class HandlerRegistry {
	private handlers = new Map<WorkerAction, MessageHandler>();

	constructor(
		private readonly logger: Logger,
		private readonly settingsDatabase: SettingsDatabase,
		private readonly watchtimeDatabase: WatchtimeDatabase,
		private readonly watchtimeAccumulator: WatchtimeAccumulator,
		private readonly enhancerApiService: EnhancerApiService,
		private readonly sharedDatabase: SharedDatabase,
		private readonly crossPlatformFollowsRefresher: CrossPlatformFollowsRefresher,
		private readonly credentialVault: CredentialVault,
		private readonly enhancerAccountService: EnhancerAccountService,
		private readonly enhancerProfileService: EnhancerProfileService,
		private readonly onApiEnvironmentChanged: (settings: GlobalSettings) => Promise<unknown> = async () => {},
	) {
		this.registerHandlers();
	}

	private registerHandlers() {
		this.handlers.set("getLogs", new GetLogsHandler(this.logger));
		this.handlers.set("ping", new PingHandler(this.logger));
		this.handlers.set("getAssetsFile", new AssetsFileHandler(this.logger));
		this.handlers.set("addWatchtime", new AddWatchtimeHandler(this.logger, this.watchtimeAccumulator));
		this.handlers.set("getWatchtime", new GetWatchtimeHandler(this.logger, this.watchtimeDatabase));
		this.handlers.set("getPaginatedWatchtime", new GetPaginatedWatchtimeHandler(this.logger, this.watchtimeDatabase));
		this.handlers.set("importWatchtime", new ImportWatchtimeHandler(this.logger, this.watchtimeDatabase));
		this.handlers.set("getSettings", new GetSettingsHandler(this.logger, this.settingsDatabase));
		this.handlers.set(
			"initializeEnhancerApi",
			new EnhancerApiHandler(this.logger, this.enhancerApiService, "initializeEnhancerApi"),
		);
		this.handlers.set(
			"joinEnhancerChannel",
			new EnhancerApiHandler(this.logger, this.enhancerApiService, "joinEnhancerChannel"),
		);
		this.handlers.set(
			"getEnhancerWatchTime",
			new EnhancerApiHandler(this.logger, this.enhancerApiService, "getEnhancerWatchTime"),
		);
		this.handlers.set(
			"disconnectEnhancerApi",
			new EnhancerApiHandler(this.logger, this.enhancerApiService, "disconnectEnhancerApi"),
		);
		this.handlers.set(
			"syncFollows",
			new SyncFollowsHandler(
				this.logger,
				this.sharedDatabase,
				this.settingsDatabase,
				this.crossPlatformFollowsRefresher,
			),
		);
		this.handlers.set(
			"updateFollow",
			new UpdateFollowHandler(
				this.logger,
				this.sharedDatabase,
				this.settingsDatabase,
				this.crossPlatformFollowsRefresher,
			),
		);
		const clearFollowsHandler = new ClearFollowsHandler(
			this.logger,
			this.sharedDatabase,
			this.crossPlatformFollowsRefresher,
		);
		this.handlers.set("clearFollows", clearFollowsHandler);
		this.handlers.set("updateSettings", new UpdateSettingsHandler(this.logger, this.settingsDatabase));
		this.handlers.set("getGlobalSettings", new GetGlobalSettingsHandler(this.logger, this.settingsDatabase));
		this.handlers.set(
			"updateGlobalSettings",
			new UpdateGlobalSettingsHandler(
				this.logger,
				this.settingsDatabase,
				this.credentialVault,
				() =>
					Promise.all([
						clearFollowsHandler.handle({ platform: "twitch" }),
						clearFollowsHandler.handle({ platform: "kick" }),
					]),
				this.onApiEnvironmentChanged,
			),
		);
		this.handlers.set(
			"getEnhancerAccountCard",
			new EnhancerAccountCardHandler(this.logger, this.enhancerAccountService, this.enhancerProfileService),
		);
		for (const action of ["getEnhancerAccount", "loginEnhancerAccount", "logoutEnhancerAccount"] as const) {
			this.handlers.set(action, new EnhancerAccountHandler(this.logger, this.enhancerAccountService, action));
		}
		for (const action of [
			"getEnhancerProfile",
			"getEnhancerBadges",
			"saveEnhancerBadgeSlot",
			"getEnhancerBilling",
			"saveEnhancerChatStyle",
			"submitEnhancerNickname",
			"clearEnhancerNickname",
			"getEnhancerAccountCache",
		] as const) {
			this.handlers.set(action, new EnhancerProfileHandler(this.logger, this.enhancerProfileService, action));
		}
		this.handlers.set(
			"syncKickSession",
			new SyncKickSessionHandler(
				this.logger,
				this.credentialVault,
				this.sharedDatabase,
				this.crossPlatformFollowsRefresher,
			),
		);
		this.handlers.set(
			"getFollowsStatus",
			new GetFollowsStatusHandler(this.logger, this.settingsDatabase, this.crossPlatformFollowsRefresher),
		);
		this.handlers.set(
			"setChannelPinned",
			new SetChannelPinnedHandler(this.logger, this.sharedDatabase, this.crossPlatformFollowsRefresher),
		);
		this.handlers.set("getStreamPlaybackUrl", new GetStreamPlaybackUrlHandler(this.logger));
		this.handlers.set("getChannelPins", new GetChannelPinsHandler(this.logger, this.sharedDatabase));
		this.handlers.set("getChannelLinks", new GetChannelLinksHandler(this.logger, this.sharedDatabase));
		this.handlers.set("updateChannelLink", new UpdateChannelLinkHandler(this.logger, this.sharedDatabase));
		this.handlers.set("removeChannelLink", new RemoveChannelLinkHandler(this.logger, this.sharedDatabase));
	}

	getHandler(action: WorkerAction): MessageHandler {
		const handler = this.handlers.get(action);
		if (!handler) {
			throw new Error(`Unknown action: ${action}`);
		}
		return handler;
	}

	hasHandler(action: string): action is WorkerAction {
		return this.handlers.has(action as WorkerAction);
	}
}
