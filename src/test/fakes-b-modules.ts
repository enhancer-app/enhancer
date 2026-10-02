import KickApi from "$kick/apis/kick.api.ts";
import { KICK_DEFAULT_SETTINGS } from "$kick/kick.constants.ts";
import KickUtils from "$kick/kick.utils.ts";
import EnhancerApi from "$shared/apis/enhancer.api.ts";
import SettingsCache from "$shared/settings/settings.service.ts";
import StorageRepository from "$shared/storage/storage-repository.ts";
import UtilsRepository from "$shared/utils/utils.repository.ts";
import WorkerService from "$shared/worker/worker.service.ts";
import TwitchApi from "$twitch/apis/twitch.api.ts";
import { TWITCH_DEFAULT_SETTINGS } from "$twitch/twitch.constants.ts";
import TwitchUtils from "$twitch/twitch.utils.ts";
import type { KickEvents } from "$types/platforms/kick/kick.events.types.ts";
import type { KickSettings } from "$types/platforms/kick/kick.settings.types.ts";
import type { KickStorage } from "$types/platforms/kick/kick.storage.types.ts";
import type { TwitchEvents } from "$types/platforms/twitch/twitch.events.types.ts";
import type { TwitchSettings } from "$types/platforms/twitch/twitch.settings.types.ts";
import type { TwitchStorage } from "$types/platforms/twitch/twitch.storage.types.ts";
import { createNanoEvents } from "nanoevents";

export function createMessageElement(marker: string | null = null, unrendered = false) {
	const attributes = new Map<string, string>();

	if (marker !== null) attributes.set("enhancer-message-handled", marker);

	const element = {
		isConnected: true,
		classList: { contains: (_name: string) => unrendered },
		getAttribute: (name: string) => attributes.get(name) ?? null,
		setAttribute: (name: string, value: string) => {
			attributes.set(name, value);
		},
	};

	// SAFETY: these message tests only access connectivity, class membership, and the implemented attribute methods.
	return element as Element;
}

export function withConstructorGlobals<T>(create: () => T): T {
	const originals = ["document", "window", "__environment__"].map(
		(key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
	);

	Object.defineProperty(globalThis, "document", {
		configurable: true,
		value: { createElement: () => new EventTarget(), body: { appendChild: () => {} } },
	});
	Object.defineProperty(globalThis, "window", { configurable: true, value: new EventTarget() });
	Object.defineProperty(globalThis, "__environment__", { configurable: true, value: "production" });

	try {
		return create();
	} finally {
		for (const [key, descriptor] of originals) {
			if (descriptor) Object.defineProperty(globalThis, key, descriptor);
			else Reflect.deleteProperty(globalThis, key);
		}
	}
}

class KickTestSettings extends SettingsCache<KickSettings> {
	get(): KickSettings {
		return { ...KICK_DEFAULT_SETTINGS, forceQualityEnabled: true, forceQualityPreferred: "highest" };
	}
}

class TwitchTestSettings extends SettingsCache<TwitchSettings> {
	get(): TwitchSettings {
		return { ...TWITCH_DEFAULT_SETTINGS };
	}
}

export function createKickDependencies(
	emitter = createNanoEvents<KickEvents>(),
	createUtils: (utils: UtilsRepository) => KickUtils = (utils) => new KickUtils(utils.reactUtils, utils.commonUtils),
) {
	return withConstructorGlobals(() => {
		const worker = new WorkerService();
		const utils = new UtilsRepository();

		return [
			emitter,
			new StorageRepository<KickStorage>(),
			new KickTestSettings("kick", worker, emitter),
			utils,
			new EnhancerApi("kick", worker, emitter),
			worker,
			createUtils(utils),
			new KickApi(),
		] as const;
	});
}

export function createTwitchDependencies(emitter = createNanoEvents<TwitchEvents>()) {
	return withConstructorGlobals(() => {
		const worker = new WorkerService();
		const utils = new UtilsRepository();
		const twitchUtils = new TwitchUtils(utils.reactUtils);

		return [
			emitter,
			new StorageRepository<TwitchStorage>(),
			new TwitchTestSettings("twitch", worker, emitter),
			utils,
			new EnhancerApi("twitch", worker, emitter),
			worker,
			twitchUtils,
			new TwitchApi(twitchUtils),
		] as const;
	});
}
