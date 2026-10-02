import { afterEach, expect, test } from "bun:test";
import SelectorModuleApplier from "$shared/module/applier/selector-module-applier.ts";
import EnhancerApi from "$shared/apis/enhancer.api.ts";
import Module from "$shared/module/module.ts";
import SettingsCache from "$shared/settings/settings.service.ts";
import StorageRepository from "$shared/storage/storage-repository.ts";
import UtilsRepository from "$shared/utils/utils.repository.ts";
import WorkerService from "$shared/worker/worker.service.ts";
import type { CommonEvents } from "$types/platforms/common.events.ts";
import type { SelectorModuleApplierConfig } from "$types/shared/module/module-applier.types.ts";
import type { ModuleConfig } from "$types/shared/module/module.types.ts";
import type { PlatformSettings } from "$types/shared/worker/settings-worker.types.ts";
import type { TestElement } from "$types/test/fakes-a.types.ts";
import { createSilentLogger } from "./fakes-a-logger.ts";
import { createNanoEvents } from "nanoevents";

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

const originalEnvironment = Object.getOwnPropertyDescriptor(globalThis, "__environment__");

class FakeElement {
	readonly writes: string[] = [];
	private readonly attributes = new Map<string, string>();
	parentElement = null;

	getAttribute(name: string) {
		return this.attributes.get(name) ?? null;
	}

	hasAttribute(name: string) {
		return this.attributes.has(name);
	}

	setAttribute(name: string, value: string) {
		this.writes.push(name);
		this.attributes.set(name, value);
	}
}

function setup(elements: FakeElement[]) {
	Object.defineProperty(globalThis, "__environment__", { configurable: true, value: "test" });
	Object.defineProperty(globalThis, "document", {
		configurable: true,
		value: {
			querySelectorAll: () => elements,
			createElement: () => new EventTarget(),
			body: { appendChild: (element: EventTarget) => element },
		},
	});
	const windowEvents = new EventTarget();
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			location: { href: "https://www.twitch.tv/channel" },
			addEventListener: windowEvents.addEventListener.bind(windowEvents),
		},
	});
}

class TestModule extends Module<CommonEvents, Record<string, string>, PlatformSettings> {
	constructor(readonly config: ModuleConfig<CommonEvents>) {
		const emitter = createNanoEvents<CommonEvents>();
		const worker = new WorkerService();
		super(
			emitter,
			new StorageRepository<Record<string, string>>(),
			new SettingsCache<PlatformSettings>("twitch", worker, emitter),
			new UtilsRepository(),
			new EnhancerApi("twitch", worker, emitter),
			worker,
		);
	}
}

function createApplier(config: Omit<SelectorModuleApplierConfig, "type" | "selectors">) {
	const applier = new SelectorModuleApplier<CommonEvents, Record<string, string>, PlatformSettings>(
		createSilentLogger(),
	);

	const moduleConfig: ModuleConfig<CommonEvents> = {
		name: "test",
		appliers: [{ type: "selector", selectors: [".target"], ...config }],
	};

	void applier.apply(new TestModule(moduleConfig));

	return { run: () => applier["run"]() };
}

afterEach(() => {
	for (const [name, descriptor] of [
		["document", originalDocument],
		["window", originalWindow],
		["__environment__", originalEnvironment],
	] as const) {
		if (descriptor) Object.defineProperty(globalThis, name, descriptor);
		else Reflect.deleteProperty(globalThis, name);
	}
});

test("marks an element once for an applier that runs on every poll", async () => {
	const element = new FakeElement();
	setup([element]);
	const calls: Element[][] = [];
	const applier = createApplier({ key: "repeating", callback: (elements) => void calls.push(elements) });

	await applier.run();
	const writesAfterFirstRun = element.writes.length;
	await applier.run();
	await applier.run();

	expect(calls).toHaveLength(3);
	expect(writesAfterFirstRun).toBeGreaterThan(0);
	expect(element.writes).toHaveLength(writesAfterFirstRun);
});

test("still runs a once applier only for new elements", async () => {
	const first = new FakeElement();
	const elements = [first];
	setup(elements);
	const calls: TestElement[][] = [];
	const applier = createApplier({ key: "once", once: true, callback: (found) => void calls.push(found) });

	await applier.run();
	await applier.run();
	const second = new FakeElement();
	elements.push(second);
	await applier.run();

	expect(calls).toEqual([[first], [second]]);
});

test("adds a second applier key to an already marked element", async () => {
	const element = new FakeElement();
	setup([element]);
	const first = createApplier({ key: "first", once: true, callback: () => {} });
	const second = createApplier({ key: "second", once: true, callback: () => {} });

	await first.run();
	await second.run();

	expect(element.getAttribute("enhanced-modules")).toBe("first;second");
});
