import type { BackupPage, BatchImportResult } from "$types/shared/utils/backup.types.ts";

export async function fetchAllPages<T>(
	fetchPage: (page: number) => Promise<BackupPage<T> | null>,
	pageSize: number,
): Promise<T[]> {
	const items: T[] = [];
	for (let page = 1; ; page++) {
		const response = await fetchPage(page);
		if (!response) throw new Error("Watchtime export incomplete");
		items.push(...response.data);
		if (response.data.length < pageSize) return items;
	}
}

export async function importInBatches<T>(
	items: T[],
	batchSize: number,
	run: (item: T) => Promise<unknown>,
): Promise<BatchImportResult> {
	let imported = 0;
	let failed = 0;
	for (let start = 0; start < items.length; start += batchSize) {
		const results = await Promise.allSettled(items.slice(start, start + batchSize).map(run));
		for (const result of results) {
			if (result.status === "fulfilled" && result.value !== null && result.value !== undefined) imported++;
			else failed++;
		}
	}
	return { imported, failed };
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
