import { Database } from "$shared/worker/database/database.ts";
import type { EnhancerApiEnvironment } from "$types/shared/enhancer-environment.types.ts";
import type { AccountSessionStore, StoredAccountSession } from "$types/shared/worker/enhancer-account-worker.types.ts";

const KEY_ID = "account";

export class EnhancerAccountDatabase extends Database implements AccountSessionStore {
	protected readonly dbName = "enhancer_account";
	protected readonly dbVersion = 1;
	private readonly sessionsStore = "sessions";
	private readonly keysStore = "keys";

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
