import type { Logger } from "$shared/logger/logger.ts";
import type { CommonEvents } from "$types/platforms/common.events.ts";
import type { PlatformSettings } from "$types/shared/worker/settings-worker.types.ts";
import type { Emitter } from "nanoevents";
import type Module from "../module.ts";
import ModuleApplier from "./module-applier.ts";

export default class EventModuleApplier<
	Events extends CommonEvents,
	Storage extends Record<string, any>,
	Settings extends PlatformSettings,
> extends ModuleApplier<Events, Storage, Settings> {
	constructor(
		logger: Logger,
		protected readonly emitter: Emitter<Events>,
	) {
		super(logger);
	}

	async apply(module: Module<Events, Storage, Settings>) {
		for (const applier of module.config.appliers) {
			if (applier.type === "event") {
				// @ts-expect-error Its needed, because of the try catch, we are just passing everything that comes to callback
				this.emitter.on(applier.event, (...args) => {
					try {
						// @ts-expect-error Same as above
						applier.callback(...args);
					} catch (error) {
						this.logger.error(`Error occurred when running module, key: ${applier.key}`, error);
					}
				});
			}
		}
	}
}
