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
	Object.defineProperty(globalThis, "chrome", { configurable: true, value: originalChrome });
	Object.defineProperty(globalThis, "__environment__", { configurable: true, value: originalEnvironment });
});

test("keeps settings in extension storage after a worker restart", async () => {
	const values = new Map<string, unknown>();
	Object.defineProperty(globalThis, "__environment__", { configurable: true, value: "test" });
	Object.defineProperty(globalThis, "chrome", {
		configurable: true,
		value: {
			storage: {
				local: {
					get: async (key: string) => ({ [key]: values.get(key) }),
					set: async (entries: Record<string, unknown>) => {
						for (const [key, value] of Object.entries(entries)) values.set(key, value);
					},
				},
			},
		},
	});

	const defaults = new Map<PlatformType, PlatformSettings>([
		["twitch", TWITCH_DEFAULT_SETTINGS],
		["kick", KICK_DEFAULT_SETTINGS],
	]);
	const firstDatabase = new SettingsDatabase(defaults);
	await firstDatabase.initialize();
	const initialSettings = await firstDatabase.getSettings<TwitchSettings>("twitch");
	expect(values.has("enhancer.settings.twitch")).toBe(false);
	await firstDatabase.updateSettings("twitch", { ...initialSettings, pinnedStreamers: ["streamer-1"] });

	const secondDatabase = new SettingsDatabase(defaults);
	await secondDatabase.initialize();
	const settingsAfterRestart = await secondDatabase.getSettings<TwitchSettings>("twitch");

	expect(settingsAfterRestart.pinnedStreamers).toEqual(["streamer-1"]);
});
