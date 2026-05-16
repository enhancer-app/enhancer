import type { CommonEvents } from "$types/platforms/common.events.ts";
import type { KickEvents } from "$types/platforms/kick/kick.events.types.ts";
import type { TwitchEvents } from "$types/platforms/twitch/twitch.events.types.ts";
import type { ModuleApplierConfig } from "$types/shared/module/module-applier.types.ts";

export type ModuleConfig<Events extends CommonEvents> = {
	name: string;
	appliers: ModuleApplierConfig<Events>[];
	enabled?: () => boolean;
};

export type TwitchModuleConfig = ModuleConfig<TwitchEvents>;

export type KickModuleConfig = ModuleConfig<KickEvents>;
