import type EnhancerApi from "$shared/apis/enhancer.api.ts";
import Module from "$shared/module/module.ts";
import type CommonDataService from "$shared/settings/common.service.ts";
import type SettingsService from "$shared/settings/settings.service.ts";
import type StorageRepository from "$shared/storage/storage-repository.ts";
import type UtilsRepository from "$shared/utils/utils.repository.ts";
import type WorkerService from "$shared/worker/worker.service.ts";
import type TwitchApi from "$twitch/apis/twitch.api.ts";
import type { TwitchEvents } from "$types/platforms/twitch/twitch.events.types.ts";
import type { TwitchSettings } from "$types/platforms/twitch/twitch.settings.types.ts";
import type { TwitchStorage } from "$types/platforms/twitch/twitch.storage.types.ts";
import type { Emitter } from "nanoevents";
import type TwitchUtils from "./twitch.utils.ts";

export default abstract class TwitchModule extends Module<TwitchEvents, TwitchStorage, TwitchSettings> {
	constructor(
		emitter: Emitter<TwitchEvents>,
		storageRepository: StorageRepository<TwitchStorage>,
		settingsService: SettingsService<TwitchSettings>,
		commonDataService: CommonDataService,
		utilsRepository: UtilsRepository,
		enhancerApi: EnhancerApi,
		workerApi: WorkerService,
		private readonly _twitchUtils: TwitchUtils,
		private readonly _twitchApi: TwitchApi,
	) {
		super(emitter, storageRepository, settingsService, commonDataService, utilsRepository, enhancerApi, workerApi);
	}

	protected twitchUtils() {
		return this._twitchUtils;
	}

	protected twitchApi() {
		return this._twitchApi;
	}
}
