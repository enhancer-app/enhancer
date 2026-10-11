import { expect, test } from "bun:test";
import SettingsCache from "$shared/settings/settings.service.ts";
import type { PlatformSettings } from "$types/shared/worker/settings-worker.types.ts";
import type { SettingsBroadcastPayload } from "$types/shared/worker/worker.types.ts";
import { createNanoEvents } from "nanoevents";

type TestSettings = PlatformSettings & { theme: string; volume: number };

function setup(options: { failUpdates?: boolean } = {}) {
	let broadcast: (payload: SettingsBroadcastPayload) => void = () => {};
	const sent: { action: string; payload: unknown }[] = [];
	const workerService = {
		onBroadcast: (_type: string, handler: typeof broadcast) => {
			broadcast = handler;
		},
		send: async (action: string, payload: unknown) => {
			sent.push({ action, payload });
			if (action === "getSettings") return { theme: "dark", volume: 50 };
			if (options.failUpdates) throw new Error("Failed to persist settings for platform: twitch");
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
	expect(sent.at(-1)).toEqual({
		action: "updateSettings",
		payload: { platform: "twitch", settings: { theme: "dark", volume: 80 } },
	});
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
