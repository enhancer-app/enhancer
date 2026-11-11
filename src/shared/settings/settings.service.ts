import type WorkerService from "$shared/worker/worker.service.ts";
import type { CommonEvents } from "$types/platforms/common.events.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { GlobalSettings } from "$types/shared/settings/global-settings.types.ts";
import type { PlatformSettings } from "$types/shared/worker/settings-worker.types.ts";
import type { SettingsBroadcastPayload } from "$types/shared/worker/worker.types.ts";
import type { Emitter } from "nanoevents";

export default class SettingsCache<T extends PlatformSettings> {
	private static readonly INITIALIZE_ATTEMPTS = 3;

	private cache: T | null = null;
	private globalCache: GlobalSettings | null = null;

	constructor(
		private readonly platformType: PlatformType,
		private readonly workerService: WorkerService,
		private readonly emitter: Emitter<CommonEvents>,
	) {
		this.workerService.onBroadcast("settings-updated", this.handleBroadcast.bind(this));
		this.workerService.onBroadcast("global-settings-updated", this.handleGlobalBroadcast.bind(this));
	}

	async initialize(): Promise<void> {
		for (let attempt = 0; attempt < SettingsCache.INITIALIZE_ATTEMPTS; attempt++) {
			const [settings, globalSettings] = await Promise.all([
				this.workerService.send("getSettings", { platform: this.platformType }),
				this.workerService.send("getGlobalSettings", {}),
			]);
			if (!settings || !globalSettings) continue;
			this.cache = settings as T;
			this.globalCache = globalSettings;
			return;
		}
		throw new Error("Settings unavailable: the background worker did not respond");
	}

	getGlobal(): GlobalSettings {
		if (!this.globalCache) throw new Error("Settings not initialized");
		return this.globalCache;
	}

	async updateGlobal(changes: Partial<GlobalSettings>): Promise<void> {
		const settings = await this.workerService.send("updateGlobalSettings", { settings: changes });
		if (!settings) throw new Error("Failed to save shared settings: the background worker did not respond");
		this.globalCache = settings;
	}

	get(): T {
		if (!this.cache) throw new Error("Settings not initialized");
		return this.cache;
	}

	async update(settings: T): Promise<void> {
		const response = await this.workerService.send("updateSettings", { platform: this.platformType, settings });
		if (!response) throw new Error(`Failed to persist settings for platform: ${this.platformType}`);
		this.cache = settings;
	}

	async updateKey<K extends keyof T>(key: K, value: T[K]): Promise<void> {
		await this.update({ ...this.get(), [key]: value });
	}

	private handleBroadcast(payload: SettingsBroadcastPayload): void {
		if (payload.platform !== this.platformType) return;
		this.cache = payload.settings as T;
		this.emitter.emit("extension:settings-refresh");
	}

	private handleGlobalBroadcast(payload: GlobalSettings): void {
		this.globalCache = payload;
		this.emitter.emit("extension:settings-refresh");
	}
}
