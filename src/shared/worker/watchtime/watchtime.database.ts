import { Database } from "$shared/worker/database/database.ts";
import { WatchtimeDatabaseMigrator } from "$shared/worker/watchtime/watchtime.database-migrator.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { WatchtimeRecord } from "$types/shared/worker/worker.types.ts";

export class WatchtimeDatabase extends Database {
	protected readonly dbName = "enhancer_watchtime";
	protected readonly dbVersion = 4;
	private readonly storeName = "watchtime";

	private readonly migrator = new WatchtimeDatabaseMigrator(this.storeName, this.logger);

	constructor() {
		super("watchtime-db");
	}

	protected onUpgrade(event: IDBVersionChangeEvent, db: IDBDatabase): void {
		this.migrator.migrate(event, db, this.dbVersion);
	}

	private createId(platform: PlatformType, username: string): string {
		return `${platform}:${username.toLowerCase()}`;
	}

	async getWatchtime(platform: PlatformType, username: string): Promise<WatchtimeRecord | null> {
		const id = this.createId(platform, username);
		const result = await this.request<WatchtimeRecord | undefined>(this.storeName, "readonly", (store) =>
			store.get(id),
		);
		return result ?? null;
	}

	async addWatchtime(platform: PlatformType, username: string, timeToAdd: number): Promise<void> {
		const now = Date.now();
		const normalizedUsername = username.toLowerCase();
		const id = this.createId(platform, normalizedUsername);
		let watchtime = await this.getWatchtime(platform, normalizedUsername);
		if (watchtime) {
			watchtime.time += timeToAdd;
			watchtime.lastUpdate = now;
		} else {
			watchtime = {
				id,
				platform,
				username: normalizedUsername,
				time: timeToAdd,
				firstUpdate: now,
				lastUpdate: now,
			};
		}
		await this.request<void>(this.storeName, "readwrite", (store) => store.put(watchtime));
	}

	async getAllWatchtimePaginated(platform: PlatformType, page: number, pageSize: number): Promise<WatchtimeRecord[]> {
		if (pageSize <= 0) {
			throw new Error("Page size must be a positive number");
		}

		const results: WatchtimeRecord[] = [];
		let skipped = 0;
		const start = (page - 1) * pageSize;

		const range = IDBKeyRange.bound([platform, 0], [platform, Number.POSITIVE_INFINITY]);

		await this.forEachCursor<WatchtimeRecord>(this.storeName, "by_platform_time", range, "prev", (value) => {
			if (skipped >= start && results.length < pageSize) {
				results.push(value);
			}
			skipped++;
			return results.length < pageSize;
		});

		return results;
	}

	async setWatchtime(watchtime: WatchtimeRecord): Promise<void> {
		await this.request<void>(this.storeName, "readwrite", (store) => store.put(watchtime));
	}
}
