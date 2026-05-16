import type KickApi from "$kick/apis/kick.api.ts";
import type KickUtils from "$kick/kick.utils.ts";
import type EnhancerApi from "$shared/apis/enhancer.api.ts";
import Module from "$shared/module/module.ts";
import type SettingsCache from "$shared/settings/settings.service.ts";
import type StorageRepository from "$shared/storage/storage-repository.ts";
import type UtilsRepository from "$shared/utils/utils.repository.ts";
import type WorkerService from "$shared/worker/worker.service.ts";
import type { KickEvents } from "$types/platforms/kick/kick.events.types.ts";
import type { KickSettings } from "$types/platforms/kick/kick.settings.types.ts";
import type { KickStorage } from "$types/platforms/kick/kick.storage.types.ts";
import type { Emitter } from "nanoevents";

export default abstract class KickModule extends Module<KickEvents, KickStorage, KickSettings> {
	constructor(
		emitter: Emitter<KickEvents>,
		storageRepository: StorageRepository<KickStorage>,
		settingsCache: SettingsCache<KickSettings>,
		utilsRepository: UtilsRepository,
		enhancerApi: EnhancerApi,
		workerApi: WorkerService,
		private readonly _kickUtils: KickUtils,
		private readonly _kickApi: KickApi,
	) {
		super(emitter, storageRepository, settingsCache, utilsRepository, enhancerApi, workerApi);
	}

	protected kickUtils() {
		return this._kickUtils;
	}

	protected kickApi() {
		return this._kickApi;
	}
}
