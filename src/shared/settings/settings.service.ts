import type WorkerService from "$shared/worker/worker.service.ts";
import type { CommonEvents } from "$types/platforms/common.events.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { PlatformSettings } from "$types/shared/worker/settings-worker.types.ts";
import type { SettingsBroadcastPayload } from "$types/shared/worker/worker.types.ts";
import type { Emitter } from "nanoevents";

export default class SettingsCache<T extends PlatformSettings> {
	private cache: T | null = null;

	constructor(
		private readonly platformType: PlatformType,
		private readonly workerService: WorkerService,
		private readonly emitter: Emitter<CommonEvents>,
	) {
		this.workerService.onBroadcast("settings-updated", this.handleBroadcast.bind(this));
	}

	async initialize(): Promise<void> {
		const settings = await this.workerService.send("getSettings", {
			platform: this.platformType,
		});
		this.cache = settings as T;
	}

	get(): T {
		if (!this.cache) throw new Error("Settings not initialized");
		return this.cache;
	}

	async update(settings: T): Promise<void> {
		await this.workerService.send("updateSettings", { platform: this.platformType, settings });
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
}
