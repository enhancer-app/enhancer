import type { Logger } from "$shared/logger/logger.ts";
import type { CommonEvents } from "$types/platforms/common.events.ts";
import type { PlatformSettings } from "$types/shared/worker/settings-worker.types.ts";
import type Module from "../module.ts";

export default class ModuleApplier<
	Events extends CommonEvents,
	Storage extends Record<string, any>,
	Settings extends PlatformSettings,
> {
	constructor(protected readonly logger: Logger) {}

	async apply(_module: Module<Events, Storage, Settings>) {
		throw new Error("Not implemented");
	}

	async start() {}
}
