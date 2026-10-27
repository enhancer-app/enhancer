import { afterEach, expect, test } from "bun:test";
import { WatchtimeAccumulator } from "$shared/worker/watchtime/watchtime.accumulator.ts";
import type { WatchtimeChannel } from "$types/shared/worker/worker.types.ts";

const originalSetInterval = globalThis.setInterval;
const originalEnvironment = (globalThis as typeof globalThis & { __environment__?: string }).__environment__;

afterEach(() => {
	globalThis.setInterval = originalSetInterval;
	Object.defineProperty(globalThis, "__environment__", { configurable: true, value: originalEnvironment });
});

function setup() {
	Object.defineProperty(globalThis, "__environment__", { configurable: true, value: "test" });
	const totals = new Map<string, number>();
	let tick: () => Promise<void> = async () => {};
	globalThis.setInterval = ((callback: () => Promise<void>, delay: number) => {
		expect(delay).toBe(5000);
		tick = callback;
		return 0;
	}) as unknown as typeof setInterval;
	const database = {
		addWatchtime: async (entries: WatchtimeChannel[], seconds: number) => {
			for (const { platform, username } of entries) {
				const key = `${platform}:${username}`;
				totals.set(key, (totals.get(key) ?? 0) + seconds);
			}
		},
	};
	const accumulator = new WatchtimeAccumulator(database as never);
	accumulator.initialize();
	return { accumulator, totals, tick: () => tick() };
}

test("credits a channel once per tick even when several tabs watch it", async () => {
	const { accumulator, totals, tick } = setup();

	await accumulator.watchChannel("twitch", "Streamer");
	await accumulator.watchChannel("twitch", "streamer");
	await accumulator.watchChannel("kick", "streamer");
	await tick();

	expect(Object.fromEntries(totals)).toEqual({ "twitch:streamer": 5, "kick:streamer": 5 });
});

test("stops crediting a channel once its tabs stop reporting", async () => {
	const { accumulator, totals, tick } = setup();

	await accumulator.watchChannel("twitch", "streamer");
	await tick();
	await tick();
	await accumulator.watchChannel("twitch", "streamer");
	await tick();

	expect(totals.get("twitch:streamer")).toBe(10);
});
