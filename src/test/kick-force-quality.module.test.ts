import { expect, test } from "bun:test";
import ForceQualityModule from "$kick/modules/force-quality/force-quality.module.ts";
import KickUtils from "$kick/kick.utils.ts";
import { Logger } from "$shared/logger/logger.ts";
import type { KickPlayerQuality } from "$types/platforms/kick/kick.utils.types.ts";
import { createKickDependencies, withConstructorGlobals } from "./fakes-b-modules.ts";

const quality = (name: string, width: number, height: number): KickPlayerQuality => ({
	name,
	width,
	height,
	bitrate: height,
	variantSource: "transcode",
});

const qualities = [
	{ ...quality("Auto", 0, 0), variantSource: "auto" as const },
	quality("1080p60", 1920, 1080),
	quality("720p60", 1280, 720),
	quality("480p", 852, 480),
];

class QualityTestLogger extends Logger {
	debug(): void {}
}

function setup(authenticated: boolean) {
	const storage = new Map<string, string>();
	const applied: string[] = [];

	class QualityTestUtils extends KickUtils {
		getQualityController() {
			return {
				qualities,
				setQuality: (selected: KickPlayerQuality) => applied.push(selected.name),
			};
		}

		isViewerAuthenticated() {
			return authenticated;
		}
	}

	const module = new ForceQualityModule(
		...createKickDependencies(undefined, (utils) => new QualityTestUtils(utils.reactUtils, utils.commonUtils)),
	);

	module["logger"] = withConstructorGlobals(() => new QualityTestLogger());
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: {
			location: { pathname: "/channel" },
			sessionStorage: {
				getItem: (key: string) => storage.get(key) ?? null,
				setItem: (key: string, value: string) => storage.set(key, value),
			},
		},
	});

	return { module, storage, applied };
}

function withWindow(run: () => void) {
	const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

	try {
		run();
	} finally {
		if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
		else Reflect.deleteProperty(globalThis, "window");
	}
}

test("stores the forced height so Kick restores it after reloading the stream", () => {
	withWindow(() => {
		const { module, storage, applied } = setup(false);

		module["run"]();
		module["run"]();

		expect(applied).toEqual(["720p60"]);
		expect(storage.get("stream_quality")).toBe("720");
	});
});

test("reapplies 1080p after Kick clears the stored preference", () => {
	withWindow(() => {
		const { module, storage, applied } = setup(true);

		module["run"]();
		storage.set("stream_quality", "");
		module["run"]();

		expect(applied).toEqual(["1080p60", "1080p60"]);
		expect(storage.get("stream_quality")).toBe("1080");
	});
});

test("keeps a quality the viewer picked manually", () => {
	withWindow(() => {
		const { module, storage, applied } = setup(true);

		module["run"]();
		storage.set("stream_quality", "480");
		module["run"]();

		expect(applied).toEqual(["1080p60"]);
	});
});
