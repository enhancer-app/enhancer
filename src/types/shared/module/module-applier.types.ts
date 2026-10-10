import type { CommonEvents } from "$types/platforms/common.events.ts";

export type ModuleApplierConfig<Events extends CommonEvents> =
	| SelectorModuleApplierConfig
	| EventModuleApplierConfig<Events>;

export type CommonModuleApplierConfig = {
	key: string;
	cooldown?: number;
	once?: boolean;
};

export type SelectorModuleApplierConfig = {
	type: "selector";
	selectors: string[];
	callback: (elements: Element[], key: string) => Promise<void> | void;
	validateUrl?: (url: string) => boolean;
	useParent?: boolean;
} & CommonModuleApplierConfig;

export type SelectorModuleApplierRunner = {
	config: SelectorModuleApplierConfig;
	enabled?: () => boolean;
	lastCheckedAt: number;
};

export type EventModuleApplierConfig<Events extends CommonEvents> = {
	[K in keyof Events]: {
		type: "event";
		event: K;
		callback: Events[K];
	} & Omit<CommonModuleApplierConfig, "cooldown">;
}[keyof Events];
