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

const originalElement = Object.getOwnPropertyDescriptor(globalThis, "Element");
const originalNode = Object.getOwnPropertyDescriptor(globalThis, "Node");

type TestApplier = {
	run(repeatingOnly?: boolean): void;
	isRelevantMutation(record: Partial<MutationRecord>): boolean;
};

function createApplier(
	configs:
		| Omit<SelectorModuleApplierConfig, "type" | "selectors">
		| Omit<SelectorModuleApplierConfig, "type" | "selectors">[],
	ignoredMutationSelectors: string[] = [],
) {
	const logger = { debug() {}, info() {}, warn() {}, error() {} } as unknown as Logger;
	const applier = new SelectorModuleApplier(logger, undefined, ignoredMutationSelectors);
	const appliers = (Array.isArray(configs) ? configs : [configs]).map((config) => ({
		type: "selector",
		selectors: [".target"],
		...config,
	}));
	void applier.apply({ config: { name: "test", appliers } } as unknown as Module<any, any, any>);
	return applier as unknown as TestApplier;
}

afterEach(() => {
	for (const [name, descriptor] of [
		["document", originalDocument],
		["window", originalWindow],
		["Element", originalElement],
		["Node", originalNode],
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

test("skips once appliers on a repeating-only run", async () => {
	setup([new FakeElement()]);
	const calls: string[] = [];
	const applier = createApplier([
		{ key: "once", once: true, callback: () => void calls.push("once") },
		{ key: "repeating", callback: () => void calls.push("repeating") },
	]);

	applier.run(true);

	expect(calls).toEqual(["repeating"]);
});

class FakeMutationTarget {
	constructor(private readonly ignored: boolean) {}

	closest() {
		return this.ignored ? this : null;
	}
}

function setupMutationGlobals() {
	Object.defineProperty(globalThis, "Node", { configurable: true, value: { ELEMENT_NODE: 1 } });
	Object.defineProperty(globalThis, "Element", { configurable: true, value: FakeMutationTarget });
}

test("ignores mutations that only add text nodes", () => {
	setupMutationGlobals();
	const applier = createApplier({ key: "test", callback: () => {} });

	const relevant = applier.isRelevantMutation({
		target: new FakeMutationTarget(false) as unknown as Node,
		addedNodes: [{ nodeType: 3 }] as unknown as NodeList,
	});

	expect(relevant).toBe(false);
});

test("ignores added elements inside ignored containers", () => {
	setupMutationGlobals();
	const applier = createApplier({ key: "test", callback: () => {} }, [".chat"]);
	const addedNodes = [{ nodeType: 1 }] as unknown as NodeList;

	expect(applier.isRelevantMutation({ target: new FakeMutationTarget(true) as unknown as Node, addedNodes })).toBe(
		false,
	);
	expect(applier.isRelevantMutation({ target: new FakeMutationTarget(false) as unknown as Node, addedNodes })).toBe(
		true,
	);
});
