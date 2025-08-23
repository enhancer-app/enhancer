import EnhancerApi from "$shared/apis/enhancer.api.ts";
import { EventEmitterFactory } from "$shared/event/event-emitter.factory.ts";
import { Logger } from "$shared/logger/logger.ts";
import EventModuleApplier from "$shared/module/applier/event-module-applier.ts";
import SelectorModuleApplier from "$shared/module/applier/selector-module-applier.ts";
import type Module from "$shared/module/module.ts";
import CommonDataService from "$shared/settings/common.service.ts";
import SettingsService from "$shared/settings/settings.service.ts";
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
	protected readonly enhancerApi: EnhancerApi;
	protected readonly workerApi = new WorkerService();
	protected readonly settingsService: SettingsService<TSettings>;
	protected readonly commonDataService = new CommonDataService(this.workerApi);

	protected constructor(protected readonly config: PlatformConfig) {
		this.enhancerApi = new EnhancerApi(config.type);
		this.settingsService = new SettingsService<TSettings>(config.type, this.workerApi);
	}

	protected async initialize(): Promise<void> {}

	async start() {
		await this.enhancerApi.initialize(); // TODO Retry if something bad happen :(
		this.workerApi.start();
		await this.initialize();
		await this.loadModules();
		this.logger.info(`Started ${this.config.type} extension`);
		// @ts-ignore tbh idk, it just works, typescript magic
		this.emitter.emit("extension:start");
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
}
