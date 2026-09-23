import { afterEach, expect, test } from "bun:test";
import type { Logger } from "$shared/logger/logger.ts";
import SelectorModuleApplier from "$shared/module/applier/selector-module-applier.ts";
import type Module from "$shared/module/module.ts";
import type { SelectorModuleApplierConfig } from "$types/shared/module/module-applier.types.ts";

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

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
	Object.defineProperty(globalThis, "document", {
		configurable: true,
		value: { querySelectorAll: () => elements },
	});
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: { location: { href: "https://www.twitch.tv/channel" } },
	});
}

function createApplier(config: Omit<SelectorModuleApplierConfig, "type" | "selectors">) {
	const logger = { debug() {}, info() {}, warn() {}, error() {} } as unknown as Logger;
	const applier = new SelectorModuleApplier(logger);
	void applier.apply({
		config: { name: "test", appliers: [{ type: "selector", selectors: [".target"], ...config }] },
	} as unknown as Module<any, any, any>);
	return applier as unknown as { run(): Promise<void> };
}

afterEach(() => {
	for (const [name, descriptor] of [
		["document", originalDocument],
		["window", originalWindow],
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
	const calls: Element[][] = [];
	const applier = createApplier({ key: "once", once: true, callback: (found) => void calls.push(found) });

	await applier.run();
	await applier.run();
	const second = new FakeElement();
	elements.push(second);
	await applier.run();

	expect(calls).toEqual([[first as unknown as Element], [second as unknown as Element]]);
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
