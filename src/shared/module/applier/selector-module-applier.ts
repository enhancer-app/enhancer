import type { Logger } from "$shared/logger/logger.ts";
import type { CommonEvents } from "$types/platforms/common.events.ts";
import type {
	SelectorModuleApplierConfig,
	SelectorModuleApplierRunner,
} from "$types/shared/module/module-applier.types.ts";
import type { PlatformSettings } from "$types/shared/worker/settings-worker.types.ts";
import type { Emitter } from "nanoevents";
import type Module from "../module.ts";
import ModuleApplier from "./module-applier.ts";

export default class SelectorModuleApplier<
	Events extends CommonEvents,
	Storage extends Record<string, any>,
	Settings extends PlatformSettings,
> extends ModuleApplier<Events, Storage, Settings> {
	private static readonly TICK_INTERVAL_MS = 1000;
	private static readonly FULL_SWEEP_INTERVAL_MS = 5000;
	private static readonly VISIBLE_RUN_GAP_MS = 500;
	private static readonly HIDDEN_RUN_GAP_MS = 2000;

	protected readonly appliers: SelectorModuleApplierRunner[] = [];
	private readonly ignoredMutationSelector: string | undefined;
	private observer: MutationObserver | undefined;
	private tickInterval: ReturnType<typeof setInterval> | undefined;
	private pendingRun: ReturnType<typeof setTimeout> | undefined;
	private lastFullRunAt = 0;
	private unbindSettingsRefresh: (() => void) | undefined;

	constructor(
		logger: Logger,
		private readonly emitter?: Emitter<Events>,
		ignoredMutationSelectors: string[] = [],
	) {
		super(logger);
		this.ignoredMutationSelector =
			ignoredMutationSelectors.length > 0 ? ignoredMutationSelectors.join(", ") : undefined;
	}

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

	async start() {
		this.stop();
		this.run();
		this.observer = new MutationObserver((records) => this.handleMutations(records));
		this.observer.observe(document.documentElement, { childList: true, subtree: true });
		this.tickInterval = setInterval(() => this.tick(), SelectorModuleApplier.TICK_INTERVAL_MS);
		document.addEventListener("visibilitychange", this.handleVisibilityChange);
		this.unbindSettingsRefresh = this.emitter?.on("extension:settings-refresh", () => this.scheduleRun());
		this.logger.debug("Started selector observer");
	}

	private stop() {
		this.observer?.disconnect();
		if (this.tickInterval) clearInterval(this.tickInterval);
		if (this.pendingRun) clearTimeout(this.pendingRun);
		this.pendingRun = undefined;
		document.removeEventListener("visibilitychange", this.handleVisibilityChange);
		this.unbindSettingsRefresh?.();
	}

	private readonly handleVisibilityChange = () => {
		if (!document.hidden) this.scheduleRun();
	};

	private handleMutations(records: MutationRecord[]) {
		if (this.pendingRun) return;
		if (records.some((record) => this.isRelevantMutation(record))) this.scheduleRun();
	}

	private isRelevantMutation({ target, addedNodes }: MutationRecord) {
		let hasAddedElement = false;
		for (const node of addedNodes) {
			if (node.nodeType === Node.ELEMENT_NODE) {
				hasAddedElement = true;
				break;
			}
		}
		if (!hasAddedElement) return false;
		if (!this.ignoredMutationSelector || !(target instanceof Element)) return true;
		return target.closest(this.ignoredMutationSelector) === null;
	}

	private scheduleRun() {
		if (this.pendingRun) return;
		const gap = document.hidden ? SelectorModuleApplier.HIDDEN_RUN_GAP_MS : SelectorModuleApplier.VISIBLE_RUN_GAP_MS;
		const delay = this.lastFullRunAt + gap - Date.now();
		if (delay <= 0) {
			this.runAndDiscardOwnMutations();
			return;
		}
		this.pendingRun = setTimeout(() => {
			this.pendingRun = undefined;
			this.runAndDiscardOwnMutations();
		}, delay);
	}

	private runAndDiscardOwnMutations() {
		this.run();
		this.observer?.takeRecords();
	}

	private tick() {
		if (this.pendingRun) return;
		if (Date.now() - this.lastFullRunAt >= SelectorModuleApplier.FULL_SWEEP_INTERVAL_MS) this.run();
		else this.run(true);
	}

	private run(repeatingOnly = false) {
		if (!repeatingOnly) this.lastFullRunAt = Date.now();
		for (const applier of this.appliers) {
			if (repeatingOnly && applier.config.once) continue;
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
				if (!element) return;
				const isAlreadyUsed = this.isElementAlreadyUsed(element, config.key);
				if (isAlreadyUsed && config.once) return;
				if (!isAlreadyUsed) this.markElementAsUsed(element, config.key);
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
