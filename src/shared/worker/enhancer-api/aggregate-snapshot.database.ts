import { SNAPSHOT_FORMAT_VERSION } from "$shared/apis/enhancer-snapshot.ts";
import { Database } from "$shared/worker/database/database.ts";
import type { EnhancerAggregateTopic } from "$types/apis/enhancer.apis.ts";
import type { StoredAggregateMeta, StoredAggregateSnapshot } from "$types/shared/worker/enhancer-api-worker.types.ts";

export class AggregateSnapshotDatabase extends Database {
	private static readonly MAX_CHANNELS = 50;
	private static readonly MAX_CHANNEL_AGE_MS = 14 * 24 * 60 * 60 * 1000;

	protected readonly dbName = "enhancer_aggregates";
	protected readonly dbVersion = 1;
	private readonly metaStore = "meta";
	private readonly fileStore = "files";

	constructor() {
		super("aggregate-db");
	}

	protected onUpgrade(_event: IDBVersionChangeEvent, db: IDBDatabase): void {
		if (!db.objectStoreNames.contains(this.metaStore)) {
			const store = db.createObjectStore(this.metaStore, { keyPath: "topic" });
			store.createIndex("by_lastUsedAt", "lastUsedAt");
		}
		if (!db.objectStoreNames.contains(this.fileStore)) db.createObjectStore(this.fileStore);
	}

	async get(topic: EnhancerAggregateTopic): Promise<StoredAggregateSnapshot | null> {
		const meta = await this.request<StoredAggregateMeta | undefined>(this.metaStore, "readonly", (store) =>
			store.get(topic),
		);
		if (!meta) return null;
		if (meta.formatVersion !== SNAPSHOT_FORMAT_VERSION) {
			await this.delete(topic);
			return null;
		}
		const bytes = await this.request<Uint8Array | undefined>(this.fileStore, "readonly", (store) => store.get(topic));
		if (!bytes) return null;
		const touched = { ...meta, lastUsedAt: Date.now() };
		void this.request(this.metaStore, "readwrite", (store) => store.put(touched)).catch(() => {});
		return { ...touched, bytes };
	}

	async put(snapshot: StoredAggregateSnapshot): Promise<void> {
		const { bytes, ...meta } = snapshot;
		await this.write((metaStore, files) => {
			metaStore.put(meta);
			files.put(bytes, meta.topic);
		});
		await this.prune();
	}

	async delete(topic: EnhancerAggregateTopic): Promise<void> {
		await this.write((meta, files) => {
			meta.delete(topic);
			files.delete(topic);
		});
	}

	private async prune(): Promise<void> {
		const channels: StoredAggregateMeta[] = [];
		await this.forEachCursor<StoredAggregateMeta>(
			this.metaStore,
			"by_lastUsedAt",
			IDBKeyRange.lowerBound(0),
			"prev",
			(meta) => {
				if (meta.scope === "CHANNEL") channels.push(meta);
				return undefined;
			},
		);
		const cutoff = Date.now() - AggregateSnapshotDatabase.MAX_CHANNEL_AGE_MS;
		const stale = channels.filter(
			(meta, index) => index >= AggregateSnapshotDatabase.MAX_CHANNELS || meta.lastUsedAt < cutoff,
		);
		for (const meta of stale) await this.delete(meta.topic);
	}

	private write(fn: (meta: IDBObjectStore, files: IDBObjectStore) => void): Promise<void> {
		const db = this.requireDatabase();
		return new Promise((resolve, reject) => {
			const tx = db.transaction([this.metaStore, this.fileStore], "readwrite");
			fn(tx.objectStore(this.metaStore), tx.objectStore(this.fileStore));
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
			tx.onabort = () => reject(tx.error);
		});
	}
}
