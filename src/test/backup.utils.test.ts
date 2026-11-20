import { expect, test } from "bun:test";
import { fetchAllPages, importInBatches } from "$shared/utils/backup.utils.ts";

function pages(...contents: (number[] | null)[]) {
	const requested: number[] = [];
	const fetchPage = async (page: number) => {
		requested.push(page);
		const data = contents[page - 1];
		return data === null ? null : { data: data ?? [] };
	};
	return { fetchPage, requested };
}

test("collects items from full pages and a short last page", async () => {
	const { fetchPage, requested } = pages([1, 2], [3, 4], [5]);

	expect(await fetchAllPages(fetchPage, 2)).toEqual([1, 2, 3, 4, 5]);
	expect(requested).toEqual([1, 2, 3]);
});

test("fails the export when a page gets no answer", async () => {
	const { fetchPage, requested } = pages([1, 2], null, [5]);

	await expect(fetchAllPages(fetchPage, 2)).rejects.toThrow("Watchtime export incomplete");
	expect(requested).toEqual([1, 2]);
});

test("counts unanswered and rejected imports as failed", async () => {
	const result = await importInBatches([1, 2, 3, 4], 2, async (item) => {
		if (item === 2) return null;
		if (item === 3) throw new Error("Invalid payload");
		return { item };
	});

	expect(result).toEqual({ imported: 2, failed: 2 });
});

test("never runs more imports at once than the batch size", async () => {
	let inFlight = 0;
	let maxInFlight = 0;
	const result = await importInBatches(
		Array.from({ length: 7 }, (_, index) => index),
		3,
		async (item) => {
			inFlight++;
			maxInFlight = Math.max(maxInFlight, inFlight);
			await Promise.resolve();
			inFlight--;
			return item;
		},
	);

	expect(maxInFlight).toBe(3);
	expect(result).toEqual({ imported: 7, failed: 0 });
});
