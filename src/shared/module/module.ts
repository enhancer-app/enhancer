import type { Emitter } from "nanoevents";
import type EnhancerApi from "$shared/apis/enhancer.api.ts";
import { Logger } from "$shared/logger/logger.ts";
import type SettingsService from "$shared/settings/settings.service.ts";
import type SharedStorageDataService from "$shared/settings/shared-storage.service.ts";
import type StorageRepository from "$shared/storage/storage-repository.ts";
import type UtilsRepository from "$shared/utils/utils.repository.ts";
import type WorkerService from "$shared/worker/worker.service.ts";
import type { CommonEvents } from "$types/platforms/common.events.ts";
import type { ModuleConfig } from "$types/shared/module/module.types.ts";
import type { PlatformSettings } from "$types/shared/worker/settings-worker.types.ts";

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
		private readonly _settingsService: SettingsService<Settings>,
		private readonly _sharedStorageDataService: SharedStorageDataService,
		private readonly utilsRepository: UtilsRepository,
		private readonly _enhancerApi: EnhancerApi,
		private readonly _workerService: WorkerService,
	) {}

	async setup() {
		// As abstract property values are not accessible during constructor execution,
		// the logger instance is initialized here using an alternative method.
		this.logger = new Logger({ context: `module:${this.config.name}` });
	}

	protected async isModuleEnabled(): Promise<boolean> {
		if (this.config.isModuleEnabledCallback) {
			return this.config.isModuleEnabledCallback();
		}
		return true;
	}

	async initialize(): Promise<void> {}

	protected getId() {
		return `enhancer-${this.config.name}`;
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

	protected settingsService() {
		return this._settingsService;
	}

	protected sharedStorageDataService() {
		return this._sharedStorageDataService;
	}
}
