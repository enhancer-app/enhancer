import type { Logger } from "$shared/logger/logger.ts";
import { EnhancerAccountHandler } from "$shared/worker/enhancer-account/enhancer-account.handler.ts";
import type { EnhancerAccountService } from "$shared/worker/enhancer-account/enhancer-account.service.ts";
import { EnhancerProfileHandler } from "$shared/worker/enhancer-account/enhancer-profile.handler.ts";
import type { EnhancerProfileService } from "$shared/worker/enhancer-account/enhancer-profile.service.ts";
import { EnhancerApiHandler } from "$shared/worker/enhancer-api/enhancer-api.handler.ts";
import type { EnhancerApiService } from "$shared/worker/enhancer-api/enhancer-api.service.ts";
import { AssetsFileHandler } from "$shared/worker/file/assets-file.handler.ts";
import { GetLogsHandler } from "$shared/worker/logs/get-logs.handler.ts";
import type { MessageHandler } from "$shared/worker/message.handler.ts";
import { MarksHandler } from "$shared/worker/marks/marks.handler.ts";
import type { MarksService } from "$shared/worker/marks/marks.service.ts";
import { PingHandler } from "$shared/worker/ping/ping.handler.ts";
import { GetSettingsHandler } from "$shared/worker/settings/get-settings.handler.ts";
import type { SettingsDatabase } from "$shared/worker/settings/settings.database.ts";
import { UpdateSettingsHandler } from "$shared/worker/settings/update-settings.handler.ts";
import { AddWatchtimeHandler } from "$shared/worker/watchtime/add-watchtime.handler.ts";
import { GetPaginatedWatchtimeHandler } from "$shared/worker/watchtime/get-paginated-watchtime.handler.ts";
import { GetWatchtimeHandler } from "$shared/worker/watchtime/get-watchtime.handler.ts";
import { ImportWatchtimeHandler } from "$shared/worker/watchtime/import-watchtime.handler.ts";
import type { WatchtimeAccumulator } from "$shared/worker/watchtime/watchtime.accumulator.ts";
import type { WatchtimeDatabase } from "$shared/worker/watchtime/watchtime.database.ts";
import type { WorkerAction } from "$types/shared/worker/worker.types.ts";

export class HandlerRegistry {
	private handlers = new Map<WorkerAction, MessageHandler>();

	constructor(
		private readonly logger: Logger,
		private readonly settingsDatabase: SettingsDatabase,
		private readonly watchtimeDatabase: WatchtimeDatabase,
		private readonly watchtimeAccumulator: WatchtimeAccumulator,
		private readonly enhancerApiService: EnhancerApiService,
		private readonly enhancerAccountService: EnhancerAccountService,
		private readonly marksService: MarksService,
		private readonly enhancerProfileService: EnhancerProfileService,
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
		this.handlers.set("updateSettings", new UpdateSettingsHandler(this.logger, this.settingsDatabase));
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
		for (const action of ["getEnhancerAccount", "loginEnhancerAccount", "logoutEnhancerAccount"] as const) {
			this.handlers.set(action, new EnhancerAccountHandler(this.logger, this.enhancerAccountService, action));
		}
		for (const action of ["getEnhancerProfile", "getEnhancerBadges", "saveEnhancerBadgeSlot"] as const) {
			this.handlers.set(action, new EnhancerProfileHandler(this.logger, this.enhancerProfileService, action));
		}
		for (const action of ["getChannelMark", "getMarkClaimStatus", "getMarkViewerState", "claimMark"] as const) {
			this.handlers.set(action, new MarksHandler(this.logger, this.marksService, action));
		}
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
