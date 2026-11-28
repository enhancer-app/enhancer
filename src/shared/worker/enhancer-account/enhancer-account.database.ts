import { Database } from "$shared/worker/database/database.ts";
import type { EnhancerApiEnvironment } from "$types/shared/enhancer-environment.types.ts";
import type {
	AccountSessionStore,
	StoredAccountCache,
	StoredAccountSession,
} from "$types/shared/worker/enhancer-account-worker.types.ts";

const KEY_ID = "account";
const CACHE_ID = "profile";

export class EnhancerAccountDatabase extends Database implements AccountSessionStore {
	protected readonly dbName = "enhancer_account";
	protected readonly dbVersion = 2;
	private readonly sessionsStore = "sessions";
	private readonly keysStore = "keys";
	private readonly cacheStore = "cache";

	constructor() {
		super("account-db");
	}

	protected onUpgrade(_event: IDBVersionChangeEvent, db: IDBDatabase): void {
		if (!db.objectStoreNames.contains(this.sessionsStore)) {
			db.createObjectStore(this.sessionsStore, { keyPath: "environment" });
		}
		if (!db.objectStoreNames.contains(this.keysStore)) {
			db.createObjectStore(this.keysStore, { keyPath: "id" });
		}
		if (!db.objectStoreNames.contains(this.cacheStore)) {
			db.createObjectStore(this.cacheStore, { keyPath: "id" });
		}
	}

	getSession(environment: EnhancerApiEnvironment): Promise<StoredAccountSession | undefined> {
		return this.request(this.sessionsStore, "readonly", (store) => store.get(environment));
	}

	async putSession(session: StoredAccountSession): Promise<void> {
		await this.request(this.sessionsStore, "readwrite", (store) => store.put(session));
	}

	async deleteSession(environment: EnhancerApiEnvironment): Promise<void> {
		await this.request(this.sessionsStore, "readwrite", (store) => store.delete(environment));
	}

	getCache(): Promise<StoredAccountCache | undefined> {
		return this.request(this.cacheStore, "readonly", (store) => store.get(CACHE_ID));
	}

	async putCache(cache: StoredAccountCache): Promise<void> {
		await this.request(this.cacheStore, "readwrite", (store) => store.put({ ...cache, id: CACHE_ID }));
	}

	async deleteCache(): Promise<void> {
		await this.request(this.cacheStore, "readwrite", (store) => store.delete(CACHE_ID));
	}

	async getKey(): Promise<CryptoKey | undefined> {
		const record = await this.request<{ id: string; key: CryptoKey } | undefined>(this.keysStore, "readonly", (store) =>
			store.get(KEY_ID),
		);
		return record?.key;
	}

	async putKey(key: CryptoKey): Promise<void> {
		await this.request(this.keysStore, "readwrite", (store) => store.put({ id: KEY_ID, key }));
	}
}
