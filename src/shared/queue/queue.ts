import type { QueueConfig, QueueValue } from "$types/shared/queue.types.ts";

export default class Queue<Value extends QueueValue> {
	private static readonly SWEEP_INTERVAL_MS = 1000;

	private queue = new Map<string, Value>();
	private lastSweepAt = 0;

	constructor(private readonly config: QueueConfig) {}

	add(key: string, value: Value) {
		this.sweepExpired();
		this.queue.set(key, value);
	}

	addByValue(value: Value) {
		this.sweepExpired();
		this.queue.set(value.queueKey, value);
	}

	get(key: string) {
		return this.getValid(key);
	}

	getAndRemove(key: string) {
		const value = this.getValid(key);
		this.queue.delete(key);
		return value;
	}

	remove(key: string) {
		this.queue.delete(key);
	}

	contains(key: string) {
		return this.getValid(key) !== undefined;
	}

	values() {
		this.sweepExpired(true);
		return [...this.queue.values()];
	}

	keys() {
		this.sweepExpired(true);
		return [...this.queue.keys()];
	}

	private getValid(key: string) {
		const value = this.queue.get(key);
		if (value === undefined || !this.isExpired(value, Date.now())) return value;
		this.queue.delete(key);
		return undefined;
	}

	private isExpired(value: Value, now: number) {
		if (!this.config.expire) return false;
		return now > value.createdAt + this.config.expire * 1000;
	}

	private sweepExpired(force = false) {
		if (!this.config.expire) return;
		const now = Date.now();
		if (!force && now - this.lastSweepAt < Queue.SWEEP_INTERVAL_MS) return;
		this.lastSweepAt = now;
		for (const [key, value] of this.queue) {
			if (this.isExpired(value, now)) this.queue.delete(key);
		}
	}
}
