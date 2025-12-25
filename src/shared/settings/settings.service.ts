import type WorkerService from "$shared/worker/worker.service.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { PlatformSettings } from "$types/shared/worker/settings-worker.types.ts";

export default class SettingsService<T extends PlatformSettings> {
	constructor(
		private readonly platformType: PlatformType,
		private readonly workerService: WorkerService,
	) {}

	async getSettings(): Promise<T> {
		const settings = await this.workerService.send("getSettings", {
			platform: this.platformType,
		});
		if (!settings) throw new Error("Could not find settings");
		return settings as T;
	}

	async getSettingsKey<K extends keyof T>(key: K): Promise<T[K]> {
		const settings = await this.getSettings();
		return settings[key];
	}

	async updateSettingsKey<K extends keyof T>(key: K, value: T[K]) {
		const settings = await this.getSettings();
		await this.updateSettings({ ...settings, [key]: value });
	}

	async updateSettings(settings: T) {
		const result = await this.workerService.send("updateSettings", { platform: this.platformType, settings });
		if (!result) return false;
		// TODO emit refresh settings
		return result.success;
	}
}
