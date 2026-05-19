import type EnhancerApi from "$shared/apis/enhancer.api.ts";
import { Logger } from "$shared/logger/logger.ts";
import type SettingsCache from "$shared/settings/settings.service.ts";
import type SharedDataCache from "$shared/shared-data/shared-data.cache.ts";
import type StorageRepository from "$shared/storage/storage-repository.ts";
import type UtilsRepository from "$shared/utils/utils.repository.ts";
import type WorkerService from "$shared/worker/worker.service.ts";
import type { CommonEvents } from "$types/platforms/common.events.ts";
import type { ModuleConfig } from "$types/shared/module/module.types.ts";
import type { PlatformSettings } from "$types/shared/worker/settings-worker.types.ts";
import type { Emitter } from "nanoevents";

export default abstract class Module<
	Events extends CommonEvents,
	Storage extends Record<string, any>,
	Settings extends PlatformSettings,
> {
	abstract readonly config: ModuleConfig<Events>;
	protected logger!: Logger;

	protected constructor(
		protected readonly emitter: Emitter<Events>,
		private readonly storageRepository: StorageRepository<Storage>,
		private readonly _settingsCache: SettingsCache<Settings>,
		private readonly utilsRepository: UtilsRepository,
		private readonly _enhancerApi: EnhancerApi,
		private readonly _workerService: WorkerService,
		private readonly _sharedDataCache: SharedDataCache,
	) {}

	async setup() {
		this.logger = new Logger({ context: `module:${this.config.name}` });
	}

	protected isModuleEnabled(): boolean {
		return this.config.enabled?.() ?? true;
	}

	initialize(): void | Promise<void> {}

	protected getId() {
		return `enhancer-${this.config.name}`;
	}

	protected settings(): Settings {
		return this._settingsCache.get();
	}

	protected settingsCache(): SettingsCache<Settings> {
		return this._settingsCache;
	}

	protected updateSettings(settings: Settings): Promise<void> {
		return this._settingsCache.update(settings);
	}

	protected updateSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
		return this._settingsCache.updateKey(key, value);
	}

	protected commonUtils() {
		return this.utilsRepository.commonUtils;
	}

	protected reactUtils() {
		return this.utilsRepository.reactUtils;
	}

	protected enhancerApi() {
		return this._enhancerApi;
	}

	protected localStorage() {
		return this.storageRepository.localStorage;
	}

	protected workerService() {
		return this._workerService;
	}

	protected sharedData(): SharedDataCache {
		return this._sharedDataCache;
	}
}
