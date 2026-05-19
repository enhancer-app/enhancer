import type EnhancerApi from "$shared/apis/enhancer.api.ts";
import Module from "$shared/module/module.ts";
import type SettingsCache from "$shared/settings/settings.service.ts";
import type SharedDataCache from "$shared/shared-data/shared-data.cache.ts";
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
		settingsCache: SettingsCache<TwitchSettings>,
		utilsRepository: UtilsRepository,
		enhancerApi: EnhancerApi,
		workerApi: WorkerService,
		sharedDataCache: SharedDataCache,
		private readonly _twitchUtils: TwitchUtils,
		private readonly _twitchApi: TwitchApi,
	) {
		super(emitter, storageRepository, settingsCache, utilsRepository, enhancerApi, workerApi, sharedDataCache);
	}

	protected twitchUtils() {
		return this._twitchUtils;
	}

	protected twitchApi() {
		return this._twitchApi;
	}
}
