import { expect, test } from "bun:test";
import ForceQualityModule from "$kick/modules/force-quality/force-quality.module.ts";
import type { KickPlayerQuality } from "$types/platforms/kick/kick.utils.types.ts";

test("reapplies quality after seeking without changing it on regular polls", async () => {
	const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
	const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
	const originalElement = Object.getOwnPropertyDescriptor(globalThis, "Element");
	class Player extends EventTarget {
		seekbar = false;

		closest() {
			return this.seekbar ? this : null;
		}
	}
	const player = new Player();
	const quality: KickPlayerQuality = {
		name: "720p60",
		width: 1280,
		height: 720,
		bitrate: 3500,
		variantSource: "transcode",
	};
	let enabled = true;
	let calls = 0;
	const module = new ForceQualityModule(
		{} as never,
		{} as never,
		{ get: () => ({ forceQualityEnabled: enabled, forceQualityPreferred: "highest" }) } as never,
		{} as never,
		{} as never,
		{} as never,
		{ getQualityController: () => ({ qualities: [quality], setQuality: () => calls++ }) } as never,
		{} as never,
	);
	(module as any).logger = { debug: () => {} };
	Object.defineProperty(globalThis, "document", {
		configurable: true,
		value: { querySelector: () => player },
	});
	Object.defineProperty(globalThis, "Element", { configurable: true, value: Player });
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: { location: { pathname: "/channel" } },
	});

	try {
		(module as any).run();
		(module as any).run();
		expect(calls).toBe(1);

		player.dispatchEvent(new Event("pointerup"));
		expect(calls).toBe(1);

		player.seekbar = true;
		player.dispatchEvent(new Event("pointerup"));
		player.dispatchEvent(new Event("pointerup"));
		await Bun.sleep(1100);
		expect(calls).toBe(2);

		enabled = false;
		player.dispatchEvent(new Event("pointerup"));
		await Bun.sleep(1100);
		expect(calls).toBe(2);
	} finally {
		if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
		else Reflect.deleteProperty(globalThis, "document");
		if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
		else Reflect.deleteProperty(globalThis, "window");
		if (originalElement) Object.defineProperty(globalThis, "Element", originalElement);
		else Reflect.deleteProperty(globalThis, "Element");
	}
});
