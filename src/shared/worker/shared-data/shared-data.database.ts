import { Database } from "$shared/worker/database/database.ts";
import { DEFAULT_SHARED_DATA } from "$shared/worker/shared-data/shared-data.constants.ts";
import type { SharedData } from "$types/shared/storage/shared-data.types.ts";

type SharedDataRecord = { id: string; data: SharedData };

export class SharedDataDatabase extends Database {
	protected readonly dbName = "enhancer_shared_data";
	protected readonly dbVersion = 1;
	private readonly storeName = "shared_data";

	constructor() {
		super("shared-data-db");
	}

	protected onUpgrade(_event: IDBVersionChangeEvent, db: IDBDatabase): void {
		this.logger.info(`Creating shared data database (version ${this.dbVersion})...`);
		db.createObjectStore(this.storeName, { keyPath: "id" });
	}

	async getData(): Promise<SharedData> {
		const result = await this.request<SharedDataRecord | undefined>(this.storeName, "readonly", (store) =>
			store.get("shared_data"),
		);
		if (!result) return this.deepMerge(DEFAULT_SHARED_DATA);
		return this.deepMerge(result.data);
	}

	async setData(data: SharedData): Promise<void> {
		await this.request<void>(this.storeName, "readwrite", (store) => store.put({ id: "shared_data", data }));
		this.logger.debug("Shared data updated");
	}

	private deepMerge(data: SharedData): SharedData {
		return {
			crossPlatformFollows: {
				twitch: {
					...DEFAULT_SHARED_DATA.crossPlatformFollows.twitch,
					...data?.crossPlatformFollows?.twitch,
				},
				kick: {
					...DEFAULT_SHARED_DATA.crossPlatformFollows.kick,
					...data?.crossPlatformFollows?.kick,
				},
			},
		};
	}
}
