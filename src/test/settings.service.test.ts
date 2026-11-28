import { expect, test } from "bun:test";
import { GLOBAL_DEFAULT_SETTINGS } from "$shared/settings/global-settings.constants.ts";
import SettingsCache from "$shared/settings/settings.service.ts";
import type { PlatformSettings } from "$types/shared/worker/settings-worker.types.ts";
import type { SettingsBroadcastPayload } from "$types/shared/worker/worker.types.ts";
import { createNanoEvents } from "nanoevents";

type TestSettings = PlatformSettings & { theme: string; volume: number };

function setup(options: { failUpdates?: boolean; timeouts?: string[] } = {}) {
	let broadcast: (payload: SettingsBroadcastPayload) => void = () => {};
	const sent: { action: string; payload: unknown }[] = [];
	const timeouts = [...(options.timeouts ?? [])];
	let stored: Record<string, unknown> = { theme: "dark", volume: 50 };
	const workerService = {
		onBroadcast: (type: string, handler: typeof broadcast) => {
			if (type === "settings-updated") broadcast = handler;
		},
		send: async (action: string, payload: unknown) => {
			sent.push({ action, payload });
			const timeout = timeouts.indexOf(action);
			if (timeout !== -1) {
				timeouts.splice(timeout, 1);
				return null;
			}
			if (action === "getSettings") return { ...stored };
			if (action === "getGlobalSettings") return GLOBAL_DEFAULT_SETTINGS;
			if (options.failUpdates) throw new Error("Failed to persist settings for platform: twitch");
			if (action === "updateGlobalSettings") {
				return { ...GLOBAL_DEFAULT_SETTINGS, ...(payload as { settings: object }).settings };
			}
			const { settings, changes } = payload as { settings?: object; changes?: object };
			stored = settings ? { ...settings } : { ...stored, ...changes };
			return { success: true, settings: { ...stored } };
		},
	};
	const emitter = createNanoEvents();
	let refreshes = 0;
	emitter.on("extension:settings-refresh", () => refreshes++);
	const cache = new SettingsCache<TestSettings>("twitch", workerService as never, emitter as never);
	return {
		cache,
		sent,
		broadcast: (payload: SettingsBroadcastPayload) => broadcast(payload),
		refreshes: () => refreshes,
	};
}

test("applies settings broadcast for its own platform and ignores other platforms", async () => {
	const { cache, broadcast, refreshes } = setup();
	await cache.initialize();

	broadcast({ platform: "kick", settings: { theme: "light", volume: 10 } } as unknown as SettingsBroadcastPayload);
	expect(cache.get()).toEqual({ theme: "dark", volume: 50 } as TestSettings);
	expect(refreshes()).toBe(0);

	broadcast({ platform: "twitch", settings: { theme: "light", volume: 10 } } as unknown as SettingsBroadcastPayload);
	expect(cache.get()).toEqual({ theme: "light", volume: 10 } as TestSettings);
	expect(refreshes()).toBe(1);
});

test("updates one key without dropping the others", async () => {
	const { cache, sent } = setup();
	await cache.initialize();

	await cache.updateKey("volume", 80);

	expect(cache.get()).toEqual({ theme: "dark", volume: 80 } as TestSettings);
	expect(sent.at(-1)).toEqual({ action: "updateSettings", payload: { platform: "twitch", changes: { volume: 80 } } });
});

test("keeps the previous settings when saving fails", async () => {
	const { cache } = setup({ failUpdates: true });
	await cache.initialize();

	await expect(cache.updateKey("volume", 80)).rejects.toThrow("Failed to persist settings");
	expect(cache.get()).toEqual({ theme: "dark", volume: 50 } as TestSettings);
});

test("refuses reads before the settings are loaded", () => {
	const { cache } = setup();

	expect(() => cache.get()).toThrow("Settings not initialized");
});

test("keeps the previous shared settings when saving them gets no answer", async () => {
	const { cache } = setup({ timeouts: ["updateGlobalSettings"] });
	await cache.initialize();

	await expect(cache.updateGlobal({ pinnedStreamersEnabled: false })).rejects.toThrow("Failed to save shared settings");
	expect(cache.getGlobal()).toEqual(GLOBAL_DEFAULT_SETTINGS);
});

test("keeps the previous settings when saving them gets no answer", async () => {
	const { cache } = setup({ timeouts: ["updateSettings"] });
	await cache.initialize();

	await expect(cache.updateKey("volume", 80)).rejects.toThrow("Failed to persist settings");
	expect(cache.get()).toEqual({ theme: "dark", volume: 50 } as TestSettings);
});

test("retries loading settings when the first request gets no answer", async () => {
	const { cache, sent } = setup({ timeouts: ["getSettings"] });

	await cache.initialize();

	expect(cache.get()).toEqual({ theme: "dark", volume: 50 } as TestSettings);
	expect(sent.filter(({ action }) => action === "getSettings")).toHaveLength(2);
});

test("gives up loading settings after three unanswered attempts", async () => {
	const { cache } = setup({ timeouts: ["getSettings", "getSettings", "getSettings"] });

	await expect(cache.initialize()).rejects.toThrow("Settings unavailable");
	expect(() => cache.get()).toThrow("Settings not initialized");
});

test("sends only the changed key when two keys change at the same time", async () => {
	const { cache, sent } = setup();
	await cache.initialize();

	await Promise.all([cache.updateKey("theme", "light"), cache.updateKey("volume", 80)]);

	expect(sent.filter(({ action }) => action === "updateSettings").map(({ payload }) => payload)).toEqual([
		{ platform: "twitch", changes: { theme: "light" } },
		{ platform: "twitch", changes: { volume: 80 } },
	]);
	expect(cache.get()).toEqual({ theme: "light", volume: 80 } as TestSettings);
});
