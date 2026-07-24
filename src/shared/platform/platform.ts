import EnhancerApi from "$shared/apis/enhancer.api.ts";
import { EventEmitterFactory } from "$shared/event/event-emitter.factory.ts";
import { Logger } from "$shared/logger/logger.ts";
import EventModuleApplier from "$shared/module/applier/event-module-applier.ts";
import SelectorModuleApplier from "$shared/module/applier/selector-module-applier.ts";
import type Module from "$shared/module/module.ts";
import SettingsCache from "$shared/settings/settings.service.ts";
import StorageRepository from "$shared/storage/storage-repository.ts";
import UtilsRepository from "$shared/utils/utils.repository.ts";
import WorkerService from "$shared/worker/worker.service.ts";
import type { CommonEvents } from "$types/platforms/common.events.ts";
import type { PlatformConfig } from "$types/shared/platform.types.ts";
import type { PlatformSettings } from "$types/shared/worker/settings-worker.types.ts";
import type { Emitter } from "nanoevents";

export default abstract class Platform<
	TModule extends Module<TEvents, TStorage, TSettings>,
	TEvents extends CommonEvents,
	TStorage extends Record<string, any>,
	TSettings extends PlatformSettings,
> {
	protected readonly logger: Logger = new Logger({ context: "main" });
	protected readonly emitter: Emitter<TEvents> = new EventEmitterFactory<TEvents>().create();
	protected readonly storageRepository = new StorageRepository<TStorage>();
	protected readonly utilsRepository = new UtilsRepository();
	protected readonly workerApi = new WorkerService();
	protected readonly enhancerApi: EnhancerApi;
	protected readonly settingsCache: SettingsCache<TSettings>;

	protected constructor(protected readonly config: PlatformConfig) {
		this.enhancerApi = new EnhancerApi(config.type, this.workerApi, this.emitter);
		this.settingsCache = new SettingsCache<TSettings>(config.type, this.workerApi, this.emitter);
	}

	protected async initialize(): Promise<void> {}

	async start() {
		await this.workerApi.start();
		await this.settingsCache.initialize();
		void this.initializeEnhancerApi();
		await this.initialize();
		await this.loadModules();
		this.logger.info(`Started ${this.config.type} extension`);
		// @ts-ignore tbh idk, it just works, typescript magic
		this.emitter.emit("extension:start");
	}

	private async initializeEnhancerApi(attempt = 1): Promise<void> {
		try {
			await this.enhancerApi.initialize();
		} catch (error) {
			this.logger.error(`EnhancerApi init attempt ${attempt} failed:`, error);
			if (attempt < 5) {
				setTimeout(() => void this.initializeEnhancerApi(attempt + 1), 5000);
			}
		}
	}

	private appliers = [
		new SelectorModuleApplier<TEvents, TStorage, TSettings>(this.logger),
		new EventModuleApplier<TEvents, TStorage, TSettings>(this.logger, this.emitter),
	];

	protected abstract getModules(): TModule[];

	async loadModules() {
		const modules = this.getModules();
		await this.registerModules(modules);
		this.logger.info(`Loaded ${modules.length} modules`);
	}

	private async registerModules(modules: Module<TEvents, TStorage, TSettings>[]) {
		for (const module of modules) {
			try {
				await module.setup();
				await module.initialize();
				for (const moduleAppliers of this.appliers) {
					await moduleAppliers.apply(module);
				}
				this.logger.debug(`${module.config.name} module has been loaded`);
			} catch (error) {
				this.logger.error(`Failed to load ${module.config.name} module: ${error}`);
			}
		}
		this.appliers.forEach((applier) => applier.start());
	}

	getPlatformType() {
		return this.config.type;
	}

	abstract shouldStart(location: Location): boolean;
}
