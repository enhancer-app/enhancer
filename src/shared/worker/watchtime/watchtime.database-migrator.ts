import type { Logger } from "$shared/logger/logger.ts";

export class WatchtimeDatabaseMigrator {
	constructor(
		private readonly storeName: string,
		private readonly logger: Logger,
	) {}

	migrate(event: IDBVersionChangeEvent, db: IDBDatabase, newVersion: number): void {
		this.logger.info(`Upgrading watchtime database from version ${event.oldVersion} to ${newVersion}...`);

		if (event.oldVersion < 1) {
			const store = db.createObjectStore(this.storeName, { keyPath: "id" });
			store.createIndex("by_platform", "platform");
			store.createIndex("by_username", "username");
			store.createIndex("by_platform_username", ["platform", "username"], {
				unique: true,
			});
			store.createIndex("by_time", "time");
			this.logger.info("Migration 1: Initial store and basic indexes created");
		}

		if (event.oldVersion < 2) {
			const request = event.target as IDBOpenDBRequest;
			const tx = request.transaction;
			if (!tx) {
				throw new Error("No transaction available during upgrade");
			}
			const store = tx.objectStore(this.storeName);
			store.createIndex("by_platform_time", ["platform", "time"]);
			this.logger.info("Migration 2: Added index by_platform_time");
		}

		if (event.oldVersion < 3) {
			const request = event.target as IDBOpenDBRequest;
			const tx = request.transaction;
			if (!tx) {
				throw new Error("No transaction available during upgrade");
			}
			const store = tx.objectStore(this.storeName);
			const index = store.index("by_username");

			const cursorRequest = index.openCursor("videos");
			cursorRequest.onsuccess = () => {
				const cursor = cursorRequest.result;
				if (cursor) {
					this.logger.info(`Deleting watchtime record for user "videos" (id: ${cursor.primaryKey})`);
					cursor.delete();
					cursor.continue();
				}
			};
			cursorRequest.onerror = () => {
				this.logger.error("Failed to remove user 'videos' during migration:", cursorRequest.error);
			};
			this.logger.info(`Migration 3: Deleting watchtime record for user "videos"`);
		}

		// Migration 4:
		// If somebody was using an older version of Enhancer, the database might have
		// already been created, which caused the 1st migration (store + base indexes)
		// to be skipped. We also had a bug that caused the 2nd migration (adding
		// by_platform_time) to be skipped as well.
		//
		// This migration ensures the object store and all required indexes exist,
		// effectively repairing the schema and undoing the earlier migration issues.
		// In short: this is the "safety net" migration to fix our previous fuckup :smutnażaba:
		if (event.oldVersion < 4) {
			const request = event.target as IDBOpenDBRequest;
			const tx = request.transaction;
			if (!tx) {
				throw new Error("No transaction available during upgrade");
			}

			const store = this.ensureObjectStore(db, tx, this.storeName, "id");

			this.ensureIndex(store, "by_platform", "platform", {});
			this.ensureIndex(store, "by_username", "username", {});
			this.ensureIndex(store, "by_platform_username", ["platform", "username"], { unique: true });
			this.ensureIndex(store, "by_time", "time", {});
			this.ensureIndex(store, "by_platform_time", ["platform", "time"], {});
			this.logger.info("Migration 4: Ensure store and all required indexes exist");
		}
	}

	private ensureObjectStore(db: IDBDatabase, tx: IDBTransaction, storeName: string, keyPath: string): IDBObjectStore {
		let store: IDBObjectStore;
		if (!db.objectStoreNames.contains(storeName)) {
			store = db.createObjectStore(storeName, { keyPath });
			this.logger.info(`Created missing object store: ${storeName}`);
		} else {
			store = tx.objectStore(storeName);
			this.logger.info(`Using existing object store: ${storeName}`);
		}
		return store;
	}

	private ensureIndex(
		store: IDBObjectStore,
		indexName: string,
		keyPath: string | string[],
		options?: IDBIndexParameters,
	): void {
		if (!store.indexNames.contains(indexName)) {
			store.createIndex(indexName, keyPath, options);
			this.logger.info(`Created missing index: ${indexName}`);
		} else {
			this.logger.info(`Index already exists: ${indexName}`);
		}
	}
}
