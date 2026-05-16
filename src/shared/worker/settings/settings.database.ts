import { Database } from "$shared/worker/database/database.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { PlatformSettings, SettingsRecord } from "$types/shared/worker/settings-worker.types.ts";

export class SettingsDatabase extends Database {
	protected readonly dbName = "enhancer_settings";
	protected readonly dbVersion = 1;
	private readonly storeName = "settings";

	private cache = new Map<PlatformType, PlatformSettings>();

	constructor(private readonly defaults: Map<PlatformType, PlatformSettings>) {
		super("settings-db");
	}

	protected onUpgrade(event: IDBVersionChangeEvent, db: IDBDatabase): void {
		this.logger.info(`Creating settings database (version ${this.dbVersion})...`);
		const store = db.createObjectStore(this.storeName, { keyPath: "id" });
		store.createIndex("by_platform", "platform", { unique: true });
		store.createIndex("by_lastUpdate", "lastUpdate");
	}

	async getSettings<T extends PlatformSettings>(platform: PlatformType): Promise<T> {
		if (this.cache.has(platform)) {
			return this.cache.get(platform) as T;
		}

		const result = await this.request<SettingsRecord | undefined>(this.storeName, "readonly", (store) =>
			store.get(platform),
		);

		const defaultSettings = this.getDefaultSettings(platform);
		const settings: PlatformSettings = result ? { ...defaultSettings, ...result.settings } : defaultSettings;

		this.cache.set(platform, settings);
		return settings as T;
	}

	async updateSettings(platform: PlatformType, settings: PlatformSettings): Promise<void> {
		const now = Date.now();
		const settingsRecord: SettingsRecord = {
			id: platform,
			platform,
			settings,
			lastUpdate: now,
		};

		await this.request<void>(this.storeName, "readwrite", (store) => store.put(settingsRecord));
		this.cache.set(platform, settings);
		this.logger.debug(`Settings updated for platform: ${platform}`);
	}

	private getDefaultSettings(platform: PlatformType): PlatformSettings {
		const defaults = this.defaults.get(platform);
		if (!defaults) {
			throw new Error(`Unknown platform: ${platform}`);
		}
		return defaults;
	}
}
