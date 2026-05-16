import { Logger } from "$shared/logger/logger.ts";

export abstract class Database {
	protected readonly logger: Logger;
	private database: IDBDatabase | null = null;

	protected abstract readonly dbName: string;
	protected abstract readonly dbVersion: number;

	protected constructor(context: string) {
		this.logger = new Logger({ context });
	}

	protected abstract onUpgrade(event: IDBVersionChangeEvent, db: IDBDatabase): void;

	async initialize(): Promise<void> {
		if (this.database) return;
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, this.dbVersion);

			request.onerror = () => {
				this.logger.error("Failed to open database:", request.error);
				reject(request.error);
			};

			request.onsuccess = () => {
				this.database = request.result;
				this.logger.info("Database loaded successfully");
				resolve();
			};

			request.onupgradeneeded = (event) => {
				this.onUpgrade(event, request.result);
			};
		});
	}

	protected requireDatabase(): IDBDatabase {
		if (!this.database) {
			throw new Error("Database not initialized");
		}
		return this.database;
	}

	protected async request<T>(
		storeName: string,
		mode: IDBTransactionMode,
		fn: (store: IDBObjectStore) => IDBRequest,
	): Promise<T> {
		const db = this.requireDatabase();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(storeName, mode);
			const store = tx.objectStore(storeName);
			const request = fn(store);
			request.onsuccess = () => resolve(request.result as T);
			request.onerror = () => {
				this.logger.error("Database request failed:", request.error);
				reject(request.error);
			};
		});
	}

	protected async forEachCursor<T>(
		storeName: string,
		indexName: string,
		range: IDBKeyRange,
		direction: IDBCursorDirection,
		callback: (value: T) => boolean | undefined,
	): Promise<void> {
		const db = this.requireDatabase();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(storeName, "readonly");
			const store = tx.objectStore(storeName);
			const index = store.index(indexName);
			const request = index.openCursor(range, direction);
			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
				if (!cursor) {
					resolve();
					return;
				}
				const shouldContinue = callback(cursor.value as T);
				if (shouldContinue === false) {
					resolve();
				} else {
					cursor.continue();
				}
			};
			request.onerror = () => {
				this.logger.error("Database cursor failed:", request.error);
				reject(request.error);
			};
		});
	}
}
