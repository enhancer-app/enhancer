import { afterEach, expect, jest, test } from "bun:test";
import { decodeBase64, EnhancerAggregateView } from "$shared/apis/enhancer-snapshot.ts";
import { ENHANCER_ENDPOINTS } from "$shared/enhancer-environment.ts";
import type { Logger } from "$shared/logger/logger.ts";
import type { AggregateSnapshotDatabase } from "$shared/worker/enhancer-api/aggregate-snapshot.database.ts";
import { EnhancerApiService } from "$shared/worker/enhancer-api/enhancer-api.service.ts";
import type { EnhancerAccount, EnhancerBadge } from "$types/apis/enhancer.apis.ts";
import type { StoredAggregateSnapshot } from "$types/shared/worker/enhancer-api-worker.types.ts";
import type { WorkerBroadcast } from "$types/shared/worker/worker.types.ts";

const originalChrome = globalThis.chrome;
const originalFetch = globalThis.fetch;
const originalWebSocket = globalThis.WebSocket;

const badge: EnhancerBadge = { badgeId: "badge-1", sources: { "1x": "badge.webp" }, name: "Badge", priority: 1 };

function varint(out: number[], value: number): void {
	let rest = value;
	while (rest >= 128) {
		out.push((rest % 128) + 128);
		rest = Math.floor(rest / 128);
	}
	out.push(rest);
}

function encodeSnapshot(topic: string, accounts: EnhancerAccount[], badges: EnhancerBadge[] = [badge]): Uint8Array {
	const index = new Map(badges.map((item, position) => [item.badgeId, position]));
	const numeric = accounts
		.filter((account) => /^[1-9]\d{0,15}$/.test(account.externalId))
		.sort((left, right) => Number(left.externalId) - Number(right.externalId));
	const header = {
		topic,
		platform: "TWITCH",
		channelId: topic.startsWith("channel:") ? "channel-id" : null,
		epoch: "epoch-1",
		seq: 0,
		badges,
		appearances: accounts
			.filter((account) => account.customNickname || account.customFont || account.hasGlow)
			.map((account) => [account.externalId, account.customNickname, account.customFont, account.hasGlow ? 1 : 0]),
		textAccounts: accounts
			.filter((account) => !numeric.includes(account) && account.badgesIds.length > 0)
			.map((account) => [account.externalId, account.badgesIds.map((id) => index.get(id))]),
	};
	const body: number[] = [];
	varint(body, numeric.length);
	let previous = 0;
	for (const account of numeric) {
		varint(body, Number(account.externalId) - previous);
		previous = Number(account.externalId);
		varint(body, account.badgesIds.length);
		for (const id of account.badgesIds) varint(body, index.get(id) as number);
	}
	const headerBytes = new TextEncoder().encode(JSON.stringify(header));
	const prefix: number[] = [0x45, 0x4e, 0x48, 0x53, 1];
	varint(prefix, headerBytes.length);
	return Uint8Array.from([...prefix, ...headerBytes, ...body]);
}

const account = (externalId: string, overrides: Partial<EnhancerAccount> = {}): EnhancerAccount => ({
	accountId: `account-${externalId}`,
	externalId,
	badgesIds: ["badge-1"],
	customNickname: null,
	customFont: null,
	hasGlow: false,
	...overrides,
});

interface FakeTopic {
	epoch: string;
	seq: number;
	hash: string;
	snapshotSeq: number;
	bytes: Uint8Array;
	events: any[];
}

const topics = new Map<string, FakeTopic>();
const missing = new Set<string>();
const silent = new Set<string>();
const fetched: string[] = [];
const fetchedOrigins: string[] = [];

function serveTopic(topic: string, accounts: EnhancerAccount[], hash = `${topic}-hash`): FakeTopic {
	const entry: FakeTopic = {
		epoch: "epoch-1",
		seq: 0,
		hash,
		snapshotSeq: 0,
		bytes: encodeSnapshot(topic, accounts),
		events: [],
	};
	topics.set(topic, entry);
	return entry;
}

function updateEvent(topic: string, seq: number, changes: Partial<Record<string, unknown>> = {}) {
	return {
		type: "aggregate.updated",
		topic,
		epoch: topics.get(topic)?.epoch ?? "epoch-1",
		seq,
		accountsUpsert: [],
		accountIdsRemove: [],
		externalIdsRemove: [],
		badgesUpsert: [],
		badgeIdsRemove: [],
		cursor: `${1000 + seq}-0`,
		...changes,
	};
}

function pushEvent(topic: string, changes: Partial<Record<string, unknown>> = {}) {
	const entry = topics.get(topic) as FakeTopic;
	entry.seq++;
	const event = updateEvent(topic, entry.seq, changes);
	entry.events.push(event);
	return event;
}

class FakeWebSocket extends EventTarget {
	static readonly OPEN = 1;
	static instance: FakeWebSocket;
	static instances = 0;
	static commands: any[] = [];
	static urls: string[] = [];
	static aliases = new Map<string, string>();
	static beforeHead: (socket: FakeWebSocket, topic: string) => void = () => {};
	readonly readyState = FakeWebSocket.OPEN;

	constructor(url: string) {
		super();
		FakeWebSocket.urls.push(url);
		FakeWebSocket.instance = this;
		FakeWebSocket.instances++;
		queueMicrotask(() => this.receive({ type: "connection.ready" }));
	}

	send(data: string): void {
		const command = JSON.parse(data);
		FakeWebSocket.commands.push(command);
		if (command.type !== "subscribe") return;
		const { subscription } = command;
		const suffix = subscription.externalId ? `:${subscription.externalId}` : "";
		const requested = `${subscription.scope.toLowerCase()}:${subscription.platform}${suffix}`;
		const topic = FakeWebSocket.aliases.get(requested) ?? requested;
		if (silent.has(topic)) return;
		queueMicrotask(() => {
			if (missing.has(topic) || !topics.has(topic)) {
				this.receive({ error: { code: "NOT_FOUND", message: "Channel not found" } });
				return;
			}
			const entry = topics.get(topic) as FakeTopic;
			this.receive({ type: "subscription.confirmed", topic });
			FakeWebSocket.beforeHead(this, topic);
			const state = command.state ?? {};
			const resync = state.epoch !== entry.epoch || state.seq === undefined || state.seq < entry.snapshotSeq;
			const from = resync ? entry.snapshotSeq : state.seq;
			this.receive({
				type: "aggregate.head",
				topic,
				epoch: entry.epoch,
				seq: entry.seq,
				snapshot: { hash: entry.hash, seq: entry.snapshotSeq, path: `/snapshot/${encodeURIComponent(topic)}` },
				resync,
				from,
			});
			for (const event of entry.events.filter((item) => item.seq > from)) {
				const { cursor: _cursor, ...stored } = event;
				this.receive(stored);
			}
			this.receive({ type: "replay.complete", topic });
		});
	}

	close(): void {
		this.dispatchEvent(new Event("close"));
	}

	receive(message: object): void {
		this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(message) }));
	}
}

const logger = { debug() {}, info() {}, warn() {}, error() {} } as unknown as Logger;

async function until(condition: () => boolean, timeoutMs = 1000): Promise<void> {
	const deadline = performance.now() + timeoutMs;
	while (!condition()) {
		if (performance.now() > deadline) throw new Error("Timed out waiting for condition");
		await new Promise((resolve) => setImmediate(resolve));
	}
}

function setup() {
	const broadcasts: WorkerBroadcast[] = [];
	globalThis.chrome = {
		tabs: {
			onRemoved: { addListener: () => {} },
			sendMessage: async (_tabId: number, message: WorkerBroadcast) => {
				broadcasts.push(message);
			},
		},
	} as unknown as typeof chrome;
	globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
	globalThis.fetch = (async (input) => {
		const url = new URL(input.toString());
		const topic = decodeURIComponent(url.pathname.slice("/snapshot/".length));
		fetched.push(topic);
		fetchedOrigins.push(url.origin);
		const entry = topics.get(topic);
		return entry ? new Response(entry.bytes.slice()) : new Response(null, { status: 404 });
	}) as typeof fetch;
	return broadcasts;
}

const subscribes = (externalId?: string) =>
	FakeWebSocket.commands.filter(
		(command) => command.type === "subscribe" && command.subscription.externalId === externalId,
	);

afterEach(() => {
	jest.useRealTimers();
	silent.clear();
	globalThis.chrome = originalChrome;
	globalThis.fetch = originalFetch;
	globalThis.WebSocket = originalWebSocket;
	FakeWebSocket.instances = 0;
	FakeWebSocket.commands = [];
	FakeWebSocket.urls = [];
	FakeWebSocket.aliases.clear();
	FakeWebSocket.beforeHead = () => {};
	topics.clear();
	missing.clear();
	fetched.length = 0;
	fetchedOrigins.length = 0;
});

test("downloads one snapshot file for every tab and sends patches in order", async () => {
	const broadcasts = setup();
	serveTopic("global:TWITCH", [account("4294967297")]);
	const service = new EnhancerApiService(logger, "6.0.0");

	const first = await service.initialize(7, 0, "client-a", "twitch");
	const second = await service.initialize(8, 0, "client-b", "twitch", first.hash);

	expect(fetched).toEqual(["global:TWITCH"]);
	expect(subscribes()[0].state).toEqual({});
	expect(first.bytes).toBeDefined();
	expect(second.bytes).toBeUndefined();
	const view = new EnhancerAggregateView(first.hash, first.seq, decodeBase64(first.bytes as string));
	expect(view.findAccount("4294967297")?.badgesIds).toEqual(["badge-1"]);

	FakeWebSocket.instance.receive(
		pushEvent("global:TWITCH", {
			accountsUpsert: [account("55", { customFont: "Inter" })],
			externalIdsRemove: ["4294967297"],
		}),
	);
	await until(() => broadcasts.filter((message) => message.type === "enhancer-api-patch").length === 2);
	const patch = broadcasts.find((message) => message.type === "enhancer-api-patch");
	if (patch?.type !== "enhancer-api-patch") throw new Error("Missing patch");
	expect(patch.payload.seq).toBe(1);
	view.applyEntries(patch.payload.accounts, patch.payload.badges);
	expect(view.findAccount("4294967297")).toBeNull();
	expect(view.customFonts()).toEqual(["Inter"]);
	expect(fetched).toHaveLength(1);
});

test("asks for a replay after a gap and for a fresh file after an epoch change", async () => {
	setup();
	serveTopic("global:TWITCH", [account("1")]);
	const service = new EnhancerApiService(logger);
	await service.initialize(7, 0, "client-a", "twitch");

	pushEvent("global:TWITCH");
	const second = pushEvent("global:TWITCH");
	FakeWebSocket.instance.receive(second);
	await until(() => subscribes().length === 2);
	expect(subscribes()[1].state).toEqual({ epoch: "epoch-1", seq: 0 });

	FakeWebSocket.instance.receive({ ...updateEvent("global:TWITCH", 3), epoch: "epoch-2" });
	await until(() => subscribes().length === 3);
	expect(subscribes()[2].state).toEqual({});
});

test("buffers live events during replay and applies each seq once", async () => {
	const broadcasts = setup();
	serveTopic("global:TWITCH", [account("1")]);
	const service = new EnhancerApiService(logger);
	await service.initialize(7, 0, "client-a", "twitch");

	pushEvent("global:TWITCH", { accountsUpsert: [account("2")] });
	const second = pushEvent("global:TWITCH", { accountsUpsert: [account("3")] });
	FakeWebSocket.beforeHead = (socket) => socket.receive(second);
	FakeWebSocket.instance.receive(second);
	await until(() => broadcasts.filter((message) => message.type === "enhancer-api-patch").length >= 2);
	await new Promise((resolve) => setTimeout(resolve, 10));

	const seqs = broadcasts.flatMap((message) => (message.type === "enhancer-api-patch" ? [message.payload.seq] : []));
	expect(seqs).toEqual([1, 2]);
});

test("resumes from the stored file without downloading it again", async () => {
	setup();
	const entry = serveTopic("global:TWITCH", [account("1")]);
	pushEvent("global:TWITCH", { accountsUpsert: [account("2")] });
	const stored: StoredAggregateSnapshot = {
		topic: "global:TWITCH",
		formatVersion: 1,
		scope: "GLOBAL",
		hash: entry.hash,
		seq: 0,
		epoch: entry.epoch,
		channelId: null,
		platform: "TWITCH",
		lastUsedAt: 0,
		bytes: entry.bytes,
	};
	const puts: StoredAggregateSnapshot[] = [];
	const store = {
		get: async () => stored,
		put: async (snapshot: StoredAggregateSnapshot) => void puts.push(snapshot),
		delete: async () => {},
	} as unknown as AggregateSnapshotDatabase;

	const service = new EnhancerApiService(logger, "6.0.0", store);
	const seed = await service.initialize(7, 0, "client-a", "twitch");

	expect(subscribes()[0].state).toEqual({ epoch: "epoch-1", seq: 0 });
	expect(fetched).toEqual([]);
	expect(puts).toEqual([]);
	expect(seed.seq).toBe(1);
	expect(seed.accounts.map(([externalId]) => externalId)).toEqual(["2"]);
});

test("rejects a missing channel and loads it once it becomes available", async () => {
	const broadcasts = setup();
	serveTopic("global:TWITCH", [account("1")]);
	const service = new EnhancerApiService(logger);
	await service.initialize(7, 0, "client-a", "twitch");

	expect(await service.joinChannel(7, 0, "client-a", "twitch", "fresh")).toBeNull();
	serveTopic("channel:TWITCH:fresh", [account("2")]);
	FakeWebSocket.instance.receive({
		type: "channel.available",
		topic: "channel:TWITCH:fresh",
		reason: "created",
		cursor: "2000-0",
	});
	await until(() =>
		broadcasts.some(
			(message) =>
				message.type === "enhancer-api-updated" &&
				message.payload.topic === "channel:TWITCH:fresh" &&
				message.payload.seed?.bytes !== undefined,
		),
	);
	expect(fetched).toEqual(["global:TWITCH", "channel:TWITCH:fresh"]);
});

test("follows a channel rename to its replacement topic", async () => {
	const broadcasts = setup();
	serveTopic("global:TWITCH", [account("1")]);
	serveTopic("channel:TWITCH:old", [account("2")]);
	const service = new EnhancerApiService(logger);
	await service.initialize(7, 0, "client-a", "twitch");
	expect(await service.joinChannel(7, 0, "client-a", "twitch", "old")).not.toBeNull();

	serveTopic("channel:TWITCH:new", [account("3")]);
	FakeWebSocket.instance.receive({
		type: "channel.unavailable",
		topic: "channel:TWITCH:old",
		reason: "renamed",
		replacementTopic: "channel:TWITCH:new",
		cursor: "3000-0",
	});
	await until(() =>
		broadcasts.some(
			(message) =>
				message.type === "enhancer-api-updated" &&
				message.payload.topic === "channel:TWITCH:new" &&
				!!message.payload.seed,
		),
	);
	const removal = broadcasts.find(
		(message) => message.type === "enhancer-api-updated" && message.payload.topic === "channel:TWITCH:old",
	);
	expect(removal?.type === "enhancer-api-updated" && removal.payload.replacementTopic).toBe("channel:TWITCH:new");
	expect(subscribes("new")).toHaveLength(1);
});

test("merges an alias confirmation into the canonical topic", async () => {
	setup();
	serveTopic("global:TWITCH", [account("1")]);
	serveTopic("channel:TWITCH:canonical", [account("2")]);
	FakeWebSocket.aliases.set("channel:TWITCH:Alias", "channel:TWITCH:canonical");
	const service = new EnhancerApiService(logger);
	await service.initialize(7, 0, "client-a", "twitch");

	const seed = await service.joinChannel(7, 0, "client-a", "twitch", "Alias");
	expect(seed?.topic).toBe("channel:TWITCH:canonical");
	const again = await service.joinChannel(8, 0, "client-b", "twitch", "canonical");
	expect(again?.topic).toBe("channel:TWITCH:canonical");
	expect(fetched).toEqual(["global:TWITCH", "channel:TWITCH:canonical"]);
});

test("looks up snapshot accounts past 2^32, text ids, and overlay removals", () => {
	const bytes = encodeSnapshot("global:KICK", [
		account("4294967297"),
		account("9007199254740991", { badgesIds: [], customNickname: "Nick", hasGlow: true }),
		account("kick-name"),
		account("12", { customFont: "Lobster" }),
	]);
	const view = new EnhancerAggregateView("hash", 0, bytes);

	expect(view.findAccount("4294967297")?.badgesIds).toEqual(["badge-1"]);
	expect(view.findAccount("9007199254740991")).toMatchObject({ customNickname: "Nick", hasGlow: true });
	expect(view.findAccount("kick-name")?.badgesIds).toEqual(["badge-1"]);
	expect(view.findAccount("13")).toBeNull();
	expect(view.customFonts()).toEqual(["Lobster"]);

	view.applyEntries([["12", null]], [["badge-1", null]]);
	expect(view.findAccount("12")).toBeNull();
	expect(view.findBadge("badge-1")).toBeNull();
	expect(view.customFonts()).toEqual([]);
});

test("switching to the test API drops production state and reconnects to the test host", async () => {
	setup();
	serveTopic("global:TWITCH", [account("1")]);
	const service = new EnhancerApiService(logger, "6.0.0");

	await service.initialize(7, 0, "client-a", "twitch");
	service.setEndpoints(ENHANCER_ENDPOINTS.test);
	const seed = await service.initialize(7, 0, "client-b", "twitch");

	expect(seed.bytes).toBeDefined();
	expect(fetchedOrigins).toEqual(["https://api.enhancer.at", "https://test-api.enhancer.at"]);
	expect(FakeWebSocket.urls).toEqual([
		"wss://api.enhancer.at/v1/ws?v=6.0.0",
		"wss://test-api.enhancer.at/v1/ws?v=6.0.0",
	]);
});

test("retries a channel the server does not answer without dropping the connection", async () => {
	const broadcasts = setup();
	serveTopic("global:TWITCH", [account("1")]);
	const service = new EnhancerApiService(logger);
	await service.initialize(7, 0, "client-a", "twitch");
	silent.add("channel:TWITCH:quiet");
	jest.useFakeTimers();

	const joined = service.joinChannel(7, 0, "client-a", "twitch", "quiet");
	await until(() => subscribes("quiet").length === 1);
	jest.advanceTimersByTime(5000);
	expect(await joined).toBeNull();
	expect(FakeWebSocket.instances).toBe(1);
	expect(FakeWebSocket.commands.at(-1)).toMatchObject({ type: "unsubscribe", subscription: { externalId: "quiet" } });

	silent.delete("channel:TWITCH:quiet");
	serveTopic("channel:TWITCH:quiet", [account("2")]);
	jest.advanceTimersByTime(29_000);
	expect(subscribes("quiet")).toHaveLength(1);
	jest.advanceTimersByTime(1000);
	await until(() =>
		broadcasts.some(
			(message) => message.type === "enhancer-api-updated" && message.payload.topic === "channel:TWITCH:quiet",
		),
	);
	expect(subscribes("quiet")).toHaveLength(2);
	expect(FakeWebSocket.instances).toBe(1);
});

test("a channel queued behind an unanswered one does not fail its join", async () => {
	setup();
	serveTopic("global:TWITCH", [account("1")]);
	const service = new EnhancerApiService(logger);
	await service.initialize(7, 0, "client-a", "twitch");
	silent.add("channel:TWITCH:first");
	silent.add("channel:TWITCH:second");
	jest.useFakeTimers();

	const first = service.joinChannel(7, 0, "client-a", "twitch", "first");
	const second = service.joinChannel(8, 0, "client-b", "twitch", "second");
	await until(() => subscribes("first").length === 1);
	jest.advanceTimersByTime(5000);
	await until(() => subscribes("second").length === 1);
	jest.advanceTimersByTime(5000);

	expect(await first).toBeNull();
	expect(await second).toBeNull();
	expect(FakeWebSocket.instances).toBe(1);
});
