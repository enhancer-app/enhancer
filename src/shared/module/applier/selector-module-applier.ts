import type { CommonEvents } from "$types/platforms/common.events.ts";
import type { SelectorModuleApplierConfig } from "$types/shared/module/module-applier.types.ts";
import type { PlatformSettings } from "$types/shared/worker/settings-worker.types.ts";
import type Module from "../module.ts";
import ModuleApplier from "./module-applier.ts";

export default class SelectorModuleApplier<
	Events extends CommonEvents,
	Storage extends Record<string, any>,
	Settings extends PlatformSettings,
> extends ModuleApplier<Events, Storage, Settings> {
	protected readonly appliers: SelectorModuleApplierRunner[] = [];

	async apply(module: Module<Events, Storage, Settings>) {
		const selectorAppliers = module.config.appliers.filter(
			(applier) => applier.type === "selector",
		) as SelectorModuleApplierConfig[];
		this.appliers.push(
			...selectorAppliers.map((selectorApplier) => ({
				config: selectorApplier,
				enabled: module.config.enabled,
				lastCheckedAt: 0,
			})),
		);
	}

	private selectorInterval: NodeJS.Timeout | undefined;

	async start() {
		await this.run();
		if (this.selectorInterval) clearInterval(this.selectorInterval);
		this.selectorInterval = setInterval(async () => this.run(), 1000);
		this.logger.debug("Started selector interval");
	}

	private async run() {
		for (const applier of this.appliers) {
			if (applier.enabled && !applier.enabled()) continue;
			if (this.isApplierOnCooldown(applier)) continue;
			applier.lastCheckedAt = Date.now();
			const { config } = applier;
			if (config.validateUrl && !config.validateUrl(window.location.href)) continue;
			const elements = this.processElements(
				config.selectors.flatMap((selector) => [...document.querySelectorAll(selector)]),
				config,
			);
			if (elements.length < 1) continue;
			try {
				config.callback(elements, config.key);
			} catch (error) {
				this.logger.error(`Error occurred when running module, key: ${applier.config.key}`, error);
			}
		}
	}

	private processElements(elements: Element[], config: SelectorModuleApplierConfig) {
		return elements
			.map((_element) => {
				let element: Element | null = _element;
				if (element && config.useParent) element = element.parentElement;
				if (!element) return undefined;
				if (this.isElementAlreadyUsed(element, config.key) && config.once) return undefined;
				this.markElementAsUsed(element, config.key);
				return element;
			})
			.filter((element): element is Element => element !== undefined);
	}

	private isApplierOnCooldown(applier: SelectorModuleApplierRunner) {
		const cooldown = applier.config.cooldown;
		if (cooldown === undefined) return false;
		return Date.now() - applier.lastCheckedAt < cooldown;
	}

	private markElementAsUsed(element: Element, id: string) {
		element.setAttribute("enhanced", "true");
		element.setAttribute("enhanced-at", `${Date.now()}`);
		const modules = new Set(element.getAttribute("enhanced-modules")?.split(";") ?? []);
		modules.add(id);
		element.setAttribute("enhanced-modules", [...modules].join(";"));
	}

	private isElementAlreadyUsed(element: Element, id: string) {
		const modules = element.getAttribute("enhanced-modules")?.split(";") ?? [];
		return element.hasAttribute("enhanced") && modules.includes(id);
	}
}

type SelectorModuleApplierRunner = {
	config: SelectorModuleApplierConfig;
	enabled?: () => boolean;
	lastCheckedAt: number;
};
