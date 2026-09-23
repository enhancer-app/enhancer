import { afterEach, expect, test } from "bun:test";
import Queue from "$shared/queue/queue.ts";
import type { QueueValue } from "$types/shared/queue.types.ts";

type TestValue = QueueValue & { id: string };

const originalNow = Date.now;
let now = 0;

function createQueue(expire = 10) {
	Date.now = () => now;
	return new Queue<TestValue>({ expire });
}

function value(id: string, createdAt = now): TestValue {
	return { id, queueKey: id, createdAt };
}

afterEach(() => {
	Date.now = originalNow;
	now = 0;
});

test("does not return entries past their expiry", () => {
	const queue = createQueue();
	queue.addByValue(value("first"));

	now = 10_000;
	expect(queue.get("first")?.id).toBe("first");
	expect(queue.contains("first")).toBe(true);

	now = 10_001;
	expect(queue.get("first")).toBeUndefined();
	expect(queue.contains("first")).toBe(false);
	expect(queue.getAndRemove("first")).toBeUndefined();
});

test("removes expired entries from listings", () => {
	const queue = createQueue();
	queue.addByValue(value("old"));
	now = 5_000;
	queue.addByValue(value("fresh"));

	now = 10_001;
	expect(queue.keys()).toEqual(["fresh"]);
	expect(queue.values().map((entry) => entry.id)).toEqual(["fresh"]);
});

test("sweeps expired entries at most once per second while adding", () => {
	const queue = createQueue(1);
	let reads = 0;
	const tracked = new Proxy(value("tracked"), {
		get(target, property, receiver) {
			if (property === "createdAt") reads++;
			return Reflect.get(target, property, receiver);
		},
	});
	now = 1_000;
	queue.addByValue(tracked);
	reads = 0;

	for (let index = 0; index < 100; index++) queue.addByValue(value(`message-${index}`));
	expect(reads).toBe(0);

	now = 2_000;
	queue.addByValue(value("next"));
	expect(reads).toBe(1);
});

test("keeps entries forever without an expiry", () => {
	const queue = createQueue(0);
	queue.addByValue(value("forever"));

	now = Number.MAX_SAFE_INTEGER;
	expect(queue.get("forever")?.id).toBe("forever");
	expect(queue.keys()).toEqual(["forever"]);
});
