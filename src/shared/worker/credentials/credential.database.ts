import { Database } from "$shared/worker/database/database.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type {
	CredentialGrant,
	CredentialScope,
	CredentialStore,
	StoredCredential,
} from "$types/shared/worker/credentials-worker.types.ts";

const KEY_ID = "credentials";

export class CredentialDatabase extends Database implements CredentialStore {
	protected readonly dbName = "enhancer_credentials";
	protected readonly dbVersion = 1;
	private readonly credentialsStore = "credentials";
	private readonly grantsStore = "grants";
	private readonly keysStore = "keys";

	constructor() {
		super("credentials-db");
	}

	protected onUpgrade(_event: IDBVersionChangeEvent, db: IDBDatabase): void {
		if (!db.objectStoreNames.contains(this.credentialsStore)) {
			db.createObjectStore(this.credentialsStore, { keyPath: "platform" });
		}
		if (!db.objectStoreNames.contains(this.grantsStore)) {
			db.createObjectStore(this.grantsStore, { keyPath: "scope" });
		}
		if (!db.objectStoreNames.contains(this.keysStore)) {
			db.createObjectStore(this.keysStore, { keyPath: "id" });
		}
	}

	getCredential(platform: PlatformType): Promise<StoredCredential | undefined> {
		return this.request(this.credentialsStore, "readonly", (store) => store.get(platform));
	}

	async putCredential(credential: StoredCredential): Promise<void> {
		await this.request(this.credentialsStore, "readwrite", (store) => store.put(credential));
	}

	async deleteCredential(platform: PlatformType): Promise<void> {
		await this.request(this.credentialsStore, "readwrite", (store) => store.delete(platform));
	}

	getGrants(): Promise<CredentialGrant[]> {
		return this.request(this.grantsStore, "readonly", (store) => store.getAll());
	}

	async putGrant(grant: CredentialGrant): Promise<void> {
		await this.request(this.grantsStore, "readwrite", (store) => store.put(grant));
	}

	async deleteGrant(scope: CredentialScope): Promise<void> {
		await this.request(this.grantsStore, "readwrite", (store) => store.delete(scope));
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
