import { Database } from "$shared/worker/database/database.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { PlatformSettings, SettingsRecord } from "$types/shared/worker/settings-worker.types.ts";

const STORAGE_KEY_PREFIX = "enhancer.settings";

export class SettingsDatabase extends Database {
	protected readonly dbName = "enhancer_settings";
	protected readonly dbVersion = 1;
	private readonly storeName = "settings";

	private cache = new Map<PlatformType, PlatformSettings>();
	private indexedDbAvailable = true;

	constructor(private readonly defaults: Map<PlatformType, PlatformSettings>) {
		super("settings-db");
	}

	async initialize(): Promise<void> {
		try {
			await super.initialize();
		} catch (error) {
			this.indexedDbAvailable = false;
			this.logger.warn("IndexedDB unavailable, using extension storage only:", error);
		}
	}

	protected onUpgrade(_event: IDBVersionChangeEvent, db: IDBDatabase): void {
		if (db.objectStoreNames.contains(this.storeName)) return;

		this.logger.info(`Creating settings database (version ${this.dbVersion})...`);
		const store = db.createObjectStore(this.storeName, { keyPath: "id" });
		store.createIndex("by_platform", "platform", { unique: true });
		store.createIndex("by_lastUpdate", "lastUpdate");
	}

	async getSettings<T extends PlatformSettings>(platform: PlatformType): Promise<T> {
		if (this.cache.has(platform)) {
			return this.cache.get(platform) as T;
		}

		const defaultSettings = this.getDefaultSettings(platform);
		const storedSettings = await this.getExtensionSettings(platform);
		if (storedSettings) {
			const settings: PlatformSettings = { ...defaultSettings, ...storedSettings };
			this.cache.set(platform, settings);
			await this.saveIndexedDbSettings(platform, settings);
			return settings as T;
		}

		const indexedDbResult = await this.getIndexedDbSettings(platform);
		const settings: PlatformSettings = indexedDbResult.record
			? { ...defaultSettings, ...indexedDbResult.record.settings }
			: defaultSettings;

		this.cache.set(platform, settings);
		if (indexedDbResult.available) await this.saveExtensionSettings(platform, settings);
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

		const extensionStorageUpdated = await this.saveExtensionSettings(platform, settings);
		const indexedDbUpdated = await this.saveIndexedDbSettings(platform, settingsRecord.settings);
		if (!extensionStorageUpdated && !indexedDbUpdated) {
			throw new Error(`Failed to persist settings for platform: ${platform}`);
		}

		this.cache.set(platform, settings);
		this.logger.debug(`Settings updated for platform: ${platform}`);
	}

	private async getExtensionSettings(platform: PlatformType): Promise<PlatformSettings | undefined> {
		try {
			const key = this.getStorageKey(platform);
			const result = await chrome.storage.local.get(key);
			const settings = result[key];
			return isRecord(settings) ? (settings as PlatformSettings) : undefined;
		} catch (error) {
			this.logger.warn("Failed to read extension storage:", error);
			return undefined;
		}
	}

	private async saveExtensionSettings(platform: PlatformType, settings: PlatformSettings): Promise<boolean> {
		try {
			await chrome.storage.local.set({ [this.getStorageKey(platform)]: settings });
			return true;
		} catch (error) {
			this.logger.warn("Failed to write extension storage:", error);
			return false;
		}
	}

	private async getIndexedDbSettings(platform: PlatformType): Promise<{ available: boolean; record?: SettingsRecord }> {
		if (!this.indexedDbAvailable) return { available: false };

		try {
			const record = await this.request<SettingsRecord | undefined>(this.storeName, "readonly", (store) =>
				store.get(platform),
			);
			return { available: true, record };
		} catch (error) {
			this.logger.warn("Failed to read IndexedDB settings:", error);
			return { available: false };
		}
	}

	private async saveIndexedDbSettings(platform: PlatformType, settings: PlatformSettings): Promise<boolean> {
		if (!this.indexedDbAvailable) return false;

		try {
			const settingsRecord: SettingsRecord = {
				id: platform,
				platform,
				settings,
				lastUpdate: Date.now(),
			};
			await this.request<void>(this.storeName, "readwrite", (store) => store.put(settingsRecord));
			return true;
		} catch (error) {
			this.logger.warn("Failed to write IndexedDB settings:", error);
			return false;
		}
	}

	private getStorageKey(platform: PlatformType): string {
		return `${STORAGE_KEY_PREFIX}.${platform}`;
	}

	private getDefaultSettings(platform: PlatformType): PlatformSettings {
		const defaults = this.defaults.get(platform);
		if (!defaults) {
			throw new Error(`Unknown platform: ${platform}`);
		}
		return defaults;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
