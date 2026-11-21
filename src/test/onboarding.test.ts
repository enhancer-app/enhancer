import { expect, test } from "bun:test";
import { openWelcomeOnFirstInstall, WELCOME_STORAGE_KEY } from "$shared/worker/onboarding/onboarding.ts";
import type { OnboardingStorageArea } from "$types/shared/worker/onboarding.types.ts";

const memoryArea = (initial: Record<string, unknown> = {}, events: string[] = [], name = "area") => {
	const data = { ...initial };
	const area: OnboardingStorageArea = {
		get: async (key) => (key in data ? { [key]: data[key] } : {}),
		set: async (items) => {
			events.push(`${name}.set`);
			Object.assign(data, items);
		},
	};
	return { area, data };
};

const failingArea: OnboardingStorageArea = {
	get: () => Promise.reject(new Error("sync disabled")),
	set: () => Promise.reject(new Error("sync disabled")),
};

const setup = (sync = memoryArea(), local = memoryArea()) => {
	const events: string[] = [];
	return {
		events,
		deps: {
			sync: sync.area,
			local: local.area,
			openWelcomePage: async () => events.push("open"),
			version: "5.4.0",
			now: () => 1000,
		},
	};
};

test("a fresh install opens the welcome page once and records it in both storage areas first", async () => {
	const events: string[] = [];
	const sync = memoryArea({}, events, "sync");
	const local = memoryArea({}, events, "local");
	const deps = { ...setup(sync, local).deps, openWelcomePage: async () => events.push("open") };

	expect(await openWelcomeOnFirstInstall("install", deps)).toBe(true);
	expect(events).toEqual(["sync.set", "local.set", "open"]);
	expect(sync.data[WELCOME_STORAGE_KEY]).toEqual({ shownAt: 1000, version: "5.4.0" });
	expect(local.data[WELCOME_STORAGE_KEY]).toEqual({ shownAt: 1000, version: "5.4.0" });

	expect(await openWelcomeOnFirstInstall("install", deps)).toBe(false);
	expect(events.filter((event) => event === "open")).toHaveLength(1);
});

test("updates and browser updates never open the welcome page", async () => {
	for (const reason of ["update", "chrome_update", "shared_module_update"]) {
		const { deps, events } = setup();
		expect(await openWelcomeOnFirstInstall(reason, deps)).toBe(false);
		expect(events).toEqual([]);
	}
});

test("a reinstall in a synced profile does not open the welcome page again", async () => {
	const { deps, events } = setup(memoryArea({ [WELCOME_STORAGE_KEY]: { shownAt: 1, version: "5.3.0" } }));
	expect(await openWelcomeOnFirstInstall("install", deps)).toBe(false);
	expect(events).toEqual([]);
});

test("the welcome page still opens and is recorded locally when sync storage fails", async () => {
	const local = memoryArea();
	const { deps, events } = setup(undefined, local);
	expect(await openWelcomeOnFirstInstall("install", { ...deps, sync: failingArea })).toBe(true);
	expect(events).toEqual(["open"]);
	expect(local.data[WELCOME_STORAGE_KEY]).toEqual({ shownAt: 1000, version: "5.4.0" });
});
