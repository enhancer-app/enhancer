import { afterEach, expect, test } from "bun:test";
import { KICK_DEFAULT_SETTINGS } from "$kick/kick.constants.ts";
import { SettingsDatabase } from "$shared/worker/settings/settings.database.ts";
import { TWITCH_DEFAULT_SETTINGS } from "$twitch/twitch.constants.ts";
import type { TwitchSettings } from "$types/platforms/twitch/twitch.settings.types.ts";
import type { PlatformSettings } from "$types/shared/worker/settings-worker.types.ts";
import type { PlatformType } from "$types/shared/worker/worker.types.ts";

const originalChrome = globalThis.chrome;
const originalEnvironment = (globalThis as typeof globalThis & { __environment__?: string }).__environment__;

afterEach(() => {
	Object.defineProperty(globalThis, "chrome", { configurable: true, writable: true, value: originalChrome });
	Object.defineProperty(globalThis, "__environment__", { configurable: true, value: originalEnvironment });
});

function setupExtensionStorage(values = new Map<string, unknown>(), options: { failWrites?: boolean } = {}) {
	Object.defineProperty(globalThis, "__environment__", { configurable: true, value: "test" });
	Object.defineProperty(globalThis, "chrome", {
		configurable: true,
		writable: true,
		value: {
			storage: {
				local: {
					get: async (key: string) => ({ [key]: values.get(key) }),
					set: async (entries: Record<string, unknown>) => {
						if (options.failWrites) throw new Error("QUOTA_BYTES quota exceeded");
						for (const [key, value] of Object.entries(entries)) values.set(key, value);
					},
				},
			},
		},
	});
	return values;
}

function createDatabase(twitchDefaults: PlatformSettings = TWITCH_DEFAULT_SETTINGS) {
	return new SettingsDatabase(
		new Map<PlatformType, PlatformSettings>([
			["twitch", twitchDefaults],
			["kick", KICK_DEFAULT_SETTINGS],
		]),
	);
}

test("keeps settings in extension storage after a worker restart", async () => {
	const values = setupExtensionStorage();

	const firstDatabase = createDatabase();
	await firstDatabase.initialize();
	const initialSettings = await firstDatabase.getSettings<TwitchSettings>("twitch");
	expect(values.has("enhancer.settings.twitch")).toBe(false);
	await firstDatabase.updateSettings("twitch", { ...initialSettings, pinnedStreamers: ["streamer-1"] });

	const secondDatabase = createDatabase();
	await secondDatabase.initialize();
	const settingsAfterRestart = await secondDatabase.getSettings<TwitchSettings>("twitch");

	expect(settingsAfterRestart.pinnedStreamers).toEqual(["streamer-1"]);
});

test("fills settings added in a newer version without overwriting stored choices", async () => {
	setupExtensionStorage(new Map([["enhancer.settings.twitch", { existing: "user-choice" }]]));
	const database = createDatabase({ existing: "default", addedLater: true } as unknown as PlatformSettings);
	await database.initialize();

	const settings = await database.getSettings("twitch");

	expect(settings as unknown).toEqual({ existing: "user-choice", addedLater: true });
});

test("ignores a corrupted stored value and falls back to defaults", async () => {
	setupExtensionStorage(new Map([["enhancer.settings.twitch", ["not", "settings"]]]));
	const database = createDatabase({ existing: "default" } as unknown as PlatformSettings);
	await database.initialize();

	expect((await database.getSettings("twitch")) as unknown).toEqual({ existing: "default" });
});

test("reports a failed save and keeps serving the last persisted settings", async () => {
	setupExtensionStorage(new Map([["enhancer.settings.twitch", { existing: "saved" }]]), { failWrites: true });
	const database = createDatabase({ existing: "default" } as unknown as PlatformSettings);
	await database.initialize();
	await database.getSettings("twitch");

	await expect(
		database.updateSettings("twitch", { existing: "unsaved" } as unknown as PlatformSettings),
	).rejects.toThrow("Failed to persist settings for platform: twitch");
	expect((await database.getSettings("twitch")) as unknown).toEqual({ existing: "saved" });
});
