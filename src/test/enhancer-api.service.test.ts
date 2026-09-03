import { afterEach, expect, test } from "bun:test";
import type { Logger } from "$shared/logger/logger.ts";
import { EnhancerApiService } from "$shared/worker/enhancer-api/enhancer-api.service.ts";
import type { CachedAggregateSeed } from "$types/shared/worker/enhancer-api-worker.types.ts";
import type { WorkerBroadcast } from "$types/shared/worker/worker.types.ts";

const originalChrome = globalThis.chrome;
const originalFetch = globalThis.fetch;
const originalWebSocket = globalThis.WebSocket;

class FakeWebSocket extends EventTarget {
	static readonly OPEN = 1;
	static instance: FakeWebSocket;
	static instances = 0;
	static urls: string[] = [];
	static commands: any[] = [];
	static onSubscribe: (socket: FakeWebSocket, command: any, topic: string) => void = (socket, _command, topic) => {
		queueMicrotask(() => socket.receive({ type: "subscription.confirmed", topic }));
		queueMicrotask(() => socket.receive({ type: "replay.complete", topic }));
	};
	readonly readyState = FakeWebSocket.OPEN;

	constructor(url: string) {
		super();
		FakeWebSocket.instance = this;
		FakeWebSocket.instances++;
		FakeWebSocket.urls.push(url);
		queueMicrotask(() => this.receive({ type: "connection.ready" }));
	}

	send(data: string): void {
		const command = JSON.parse(data);
		FakeWebSocket.commands.push(command);
		if (command.type !== "subscribe") return;
		const { subscription } = command;
		const suffix = subscription.externalId ? `:${subscription.externalId}` : "";
		const topic = `${subscription.scope.toLowerCase()}:${subscription.platform}${suffix}`;
		FakeWebSocket.onSubscribe(this, command, topic);
	}

	close(): void {
		this.dispatchEvent(new Event("close"));
	}

	receive(message: object): void {
		this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(message) }));
	}

	static reset(): void {
		FakeWebSocket.instances = 0;
		FakeWebSocket.urls = [];
		FakeWebSocket.commands = [];
		FakeWebSocket.onSubscribe = (socket, _command, topic) => {
			queueMicrotask(() => socket.receive({ type: "subscription.confirmed", topic }));
			queueMicrotask(() => socket.receive({ type: "replay.complete", topic }));
		};
	}
}

const logger = { debug() {}, info() {}, warn() {}, error() {} } as unknown as Logger;
const waitForEvents = () => new Promise((resolve) => setTimeout(resolve, 20));
const aggregate = (cursor: string, accountId = "account-1") => ({
	channelId: null,
	platform: "TWITCH" as const,
	accounts: [
		{
			accountId,
			externalId: accountId,
			badgesIds: ["badge-1"],
			customNickname: null,
			customFont: null,
			hasGlow: false,
		},
	],
	badges: [{ badgeId: "badge-1", sources: { "18x18": "badge.webp" }, name: "Badge", priority: 1 }],
	cursor,
});

function setupChrome(
	seeds = new Map<number, CachedAggregateSeed | null>(),
	onBroadcast?: (message: WorkerBroadcast) => Promise<void>,
) {
	const broadcasts: WorkerBroadcast[] = [];
	let closeTab: (tabId: number) => void = () => {};
	globalThis.chrome = {
		tabs: {
			onRemoved: {
				addListener: (listener: (tabId: number) => void) => {
					closeTab = listener;
				},
			},
			query: async () => [...seeds.keys()].map((id) => ({ id })),
			sendMessage: async (tabId: number, message: WorkerBroadcast) => {
				if (message.type === "enhancer-api-seed-request") return seeds.get(tabId) ?? null;
				broadcasts.push(message);
				await onBroadcast?.(message);
			},
		},
	} as unknown as typeof chrome;
	return { broadcasts, closeTab };
}

afterEach(() => {
	globalThis.chrome = originalChrome;
	globalThis.fetch = originalFetch;
	globalThis.WebSocket = originalWebSocket;
	FakeWebSocket.reset();
});

test("uses one HTTP snapshot and applies final patches without refetching", async () => {
	const { broadcasts } = setupChrome();
	globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
	const requests: URL[] = [];
	globalThis.fetch = (async (input) => {
		const url = new URL(input.toString());
		requests.push(url);
		return Response.json(aggregate("100-0"));
	}) as typeof fetch;

	const service = new EnhancerApiService(logger, "5.1.41");
	const first = await service.initialize(7, 0, "client-a", "twitch");
	const second = await service.initialize(8, 0, "client-b", "twitch");

	expect(requests).toHaveLength(1);
	expect(requests[0].search).toBe("");
	expect(first.cursor).toBe("100-0");
	expect(second.aggregate.accounts).toHaveLength(1);
	expect(FakeWebSocket.instances).toBe(1);
	expect(FakeWebSocket.urls).toEqual(["wss://api.enhancer.at/v1/ws?v=5.1.41"]);
	expect(FakeWebSocket.commands.find((command) => command.type === "subscribe")?.after).toBe("100-0");

	FakeWebSocket.instance.receive({
		type: "aggregate.updated",
		topic: "global:TWITCH",
		accountsUpsert: [
			{
				accountId: "account-2",
				externalId: "user-2",
				badgesIds: ["badge-2"],
				customNickname: "new",
				customFont: null,
				hasGlow: true,
			},
		],
		accountIdsRemove: ["account-1"],
		badgesUpsert: [{ badgeId: "badge-2", sources: {}, name: "New", priority: 2 }],
		badgeIdsRemove: ["badge-1"],
		cursor: "100-1",
	});
	await waitForEvents();

	const updates = broadcasts.filter((message) => message.type === "enhancer-api-updated");
	expect(updates).toHaveLength(2);
	expect(updates[0].payload.cursor).toBe("100-1");
	expect(updates[0].payload.aggregate?.accounts.map((account) => account.accountId)).toEqual(["account-2"]);
	expect(updates[0].payload.aggregate?.badges.map((badge) => badge.badgeId)).toEqual(["badge-2"]);
	expect(requests).toHaveLength(1);

	service.disconnect(7, 0, "client-a", "twitch");
	service.disconnect(8, 0, "client-b", "twitch");
});

test("installs a complete snapshot before applying buffered updates", async () => {
	const { broadcasts } = setupChrome();
	globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
	let requests = 0;
	globalThis.fetch = (async () => {
		requests++;
		return Response.json(aggregate("200-0"));
	}) as unknown as typeof fetch;

	const service = new EnhancerApiService(logger);
	await service.initialize(7, 0, "client-a", "twitch");
	broadcasts.length = 0;
	FakeWebSocket.instance.receive({ type: "sync.required", topic: "global:TWITCH" });
	FakeWebSocket.instance.receive({
		type: "aggregate.updated",
		topic: "global:TWITCH",
		accountsUpsert: [aggregate("0", "after-snapshot").accounts[0]],
		accountIdsRemove: [],
		badgesUpsert: [],
		badgeIdsRemove: [],
		cursor: "200-2",
	});
	FakeWebSocket.instance.receive({
		...aggregate("200-1", "snapshot-2"),
		type: "aggregate.snapshot",
		topic: "global:TWITCH",
		snapshotId: "snapshot-a",
		page: 1,
		hasNextPage: false,
	});
	expect(broadcasts).toHaveLength(0);
	FakeWebSocket.instance.receive({
		...aggregate("200-1", "snapshot-1"),
		type: "aggregate.snapshot",
		topic: "global:TWITCH",
		snapshotId: "snapshot-a",
		page: 0,
		hasNextPage: true,
	});
	await waitForEvents();

	const updates = broadcasts.filter((message) => message.type === "enhancer-api-updated");
	const last = updates.at(-1);
	expect(last?.payload.cursor).toBe("200-2");
	expect(last?.payload.aggregate?.accounts.map((account) => account.accountId)).toEqual([
		"snapshot-1",
		"snapshot-2",
		"after-snapshot",
	]);
	expect(requests).toBe(1);
	service.disconnect(7, 0, "client-a", "twitch");
});

test("moves unavailable channels through pending, restore, and canonical rename", async () => {
	const { broadcasts } = setupChrome();
	globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
	const requests: string[] = [];
	let oldAvailable = false;
	globalThis.fetch = (async (input) => {
		const url = new URL(input.toString());
		const externalId = decodeURIComponent(url.pathname.split("/").at(-2) as string);
		requests.push(externalId);
		if (externalId === "old" && !oldAvailable) return new Response(null, { status: 404 });
		return Response.json(aggregate(`${300 + requests.length}-0`, `${externalId}-account`));
	}) as typeof fetch;

	const service = new EnhancerApiService(logger);
	await service.initialize(7, 0, "client-a", "twitch");
	expect(await service.joinChannel(7, 0, "client-a", "twitch", "old")).toBeNull();
	oldAvailable = true;
	FakeWebSocket.instance.receive({
		type: "channel.available",
		topic: "channel:TWITCH:old",
		reason: "created",
		cursor: "310-0",
	});
	await waitForEvents();
	expect(FakeWebSocket.commands.some((command) => command.subscription?.externalId === "old")).toBe(true);

	FakeWebSocket.instance.receive({
		type: "channel.unavailable",
		topic: "channel:TWITCH:old",
		reason: "archived",
		cursor: "400-0",
	});
	await waitForEvents();
	expect(
		broadcasts.some(
			(message) =>
				message.type === "enhancer-api-updated" &&
				message.payload.topic === "channel:TWITCH:old" &&
				!message.payload.aggregate,
		),
	).toBe(true);

	FakeWebSocket.instance.receive({
		type: "channel.available",
		topic: "channel:TWITCH:old",
		reason: "restored",
		cursor: "401-0",
	});
	await waitForEvents();
	FakeWebSocket.instance.receive({
		type: "channel.unavailable",
		topic: "channel:TWITCH:old",
		reason: "renamed",
		replacementTopic: "channel:TWITCH:new",
		cursor: "500-0",
	});
	await waitForEvents();

	expect(requests.filter((externalId) => externalId === "old")).toHaveLength(3);
	expect(requests.filter((externalId) => externalId === "new")).toHaveLength(1);
	expect(FakeWebSocket.commands.some((command) => command.subscription?.externalId === "new")).toBe(true);
	expect(
		broadcasts.some(
			(message) => message.type === "enhancer-api-updated" && message.payload.replacementTopic === "channel:TWITCH:new",
		),
	).toBe(true);
	service.disconnect(7, 0, "client-a", "twitch");
});

test("chooses the newest tab seed and applies only newer buffered events after worker restart", async () => {
	const oldest: CachedAggregateSeed = {
		topic: "global:TWITCH",
		aggregate: aggregate("0", "oldest"),
		cursor: "600-0",
	};
	const newest: CachedAggregateSeed = {
		topic: "global:TWITCH",
		aggregate: aggregate("0", "newest"),
		cursor: "600-3",
	};
	const { broadcasts } = setupChrome(
		new Map<number, CachedAggregateSeed | null>([
			[7, oldest],
			[8, newest],
		]),
	);
	globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
	globalThis.fetch = (() => {
		throw new Error("HTTP must not run when a seed exists");
	}) as unknown as typeof fetch;
	FakeWebSocket.onSubscribe = (socket, _command, topic) => {
		queueMicrotask(() => socket.receive({ type: "subscription.confirmed", topic }));
		queueMicrotask(() =>
			socket.receive({
				type: "aggregate.updated",
				topic,
				accountsUpsert: [aggregate("0", "stale-replay").accounts[0]],
				accountIdsRemove: [],
				badgesUpsert: [],
				badgeIdsRemove: [],
				cursor: "600-2",
			}),
		);
		queueMicrotask(() =>
			socket.receive({
				type: "aggregate.updated",
				topic,
				accountsUpsert: [aggregate("0", "fresh-replay").accounts[0]],
				accountIdsRemove: [],
				badgesUpsert: [],
				badgeIdsRemove: [],
				cursor: "600-4",
			}),
		);
		queueMicrotask(() => socket.receive({ type: "replay.complete", topic }));
	};

	const service = new EnhancerApiService(logger);
	const result = await service.initialize(7, 0, "client-a", "twitch", oldest);

	expect(FakeWebSocket.commands.find((command) => command.type === "subscribe")?.after).toBe("600-0");
	expect(result.cursor).toBe("600-4");
	expect(result.aggregate.accounts.map((account) => account.accountId)).toEqual(["newest", "fresh-replay"]);
	expect(broadcasts.filter((message) => message.type === "enhancer-api-updated")).toHaveLength(1);
	service.disconnect(7, 0, "client-a", "twitch");
});

test("discovers an existing tab seed before falling back to HTTP", async () => {
	const seed: CachedAggregateSeed = {
		topic: "global:TWITCH",
		aggregate: aggregate("0", "seeded"),
		cursor: "700-3",
	};
	setupChrome(new Map([[8, seed]]));
	globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
	globalThis.fetch = (() => {
		throw new Error("HTTP must not run when another tab has a seed");
	}) as unknown as typeof fetch;

	const service = new EnhancerApiService(logger);
	const result = await service.initialize(7, 0, "client-a", "twitch");

	expect(result.cursor).toBe("700-3");
	expect(result.aggregate.accounts[0].accountId).toBe("seeded");
	expect(FakeWebSocket.commands.find((command) => command.type === "subscribe")?.after).toBe("700-3");
	service.disconnect(7, 0, "client-a", "twitch");
});

test("retries a pending channel when availability races its initial 404", async () => {
	setupChrome();
	globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
	let resolveMissing: (response: Response) => void = () => {};
	let channelRequests = 0;
	globalThis.fetch = (async (input) => {
		const url = new URL(input.toString());
		if (!url.pathname.includes("/racing/")) return Response.json(aggregate("800-0"));
		channelRequests++;
		if (channelRequests === 1) {
			return new Promise<Response>((resolve) => {
				resolveMissing = resolve;
			});
		}
		return Response.json(aggregate("800-2", "available"));
	}) as typeof fetch;

	const service = new EnhancerApiService(logger);
	await service.initialize(7, 0, "client-a", "twitch");
	const pending = service.joinChannel(7, 0, "client-a", "twitch", "racing");
	while (channelRequests === 0) await Promise.resolve();
	FakeWebSocket.instance.receive({
		type: "channel.available",
		topic: "channel:TWITCH:racing",
		reason: "created",
		cursor: "800-1",
	});
	resolveMissing(new Response(null, { status: 404 }));

	expect(await pending).toBeNull();
	await waitForEvents();
	expect(channelRequests).toBe(2);
	expect(FakeWebSocket.commands.some((command) => command.subscription?.externalId === "racing")).toBe(true);
	service.disconnect(7, 0, "client-a", "twitch");
});

test("merges an alias confirmation into an existing canonical topic", async () => {
	const { broadcasts } = setupChrome();
	globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
	globalThis.fetch = (async (input) => {
		const alias = new URL(input.toString()).pathname.includes("/alias/");
		return Response.json(aggregate(alias ? "900-3" : "900-0", alias ? "alias-account" : "canonical-account"));
	}) as typeof fetch;
	FakeWebSocket.onSubscribe = (socket, command, topic) => {
		const confirmedTopic = command.subscription.externalId === "alias" ? "channel:TWITCH:canonical" : topic;
		queueMicrotask(() => socket.receive({ type: "subscription.confirmed", topic: confirmedTopic }));
		queueMicrotask(() => socket.receive({ type: "replay.complete", topic: confirmedTopic }));
	};

	const service = new EnhancerApiService(logger);
	await service.initialize(7, 0, "client-a", "twitch");
	await service.joinChannel(7, 0, "client-a", "twitch", "canonical");
	FakeWebSocket.instance.receive({
		type: "channel.unavailable",
		topic: "channel:TWITCH:canonical",
		reason: "archived",
		cursor: "900-2",
	});
	await waitForEvents();
	await service.initialize(8, 0, "client-b", "twitch");
	const alias = await service.joinChannel(8, 0, "client-b", "twitch", "alias");
	expect(alias?.topic).toBe("channel:TWITCH:canonical");
	expect(alias?.aggregate.accounts[0].accountId).toBe("alias-account");

	broadcasts.length = 0;
	FakeWebSocket.instance.receive({
		type: "message",
		target: { scope: "CHANNEL", platform: "TWITCH", externalId: "canonical" },
		name: "channel.message",
		cursor: "900-4",
	});
	await waitForEvents();
	expect(
		broadcasts
			.filter((message) => message.type === "enhancer-api-message")
			.map((message) => message.payload.clientId)
			.sort(),
	).toEqual(["client-a", "client-b"]);
	service.disconnect(7, 0, "client-a", "twitch");
	service.disconnect(8, 0, "client-b", "twitch");
});

test("ignores an unavailable event older than the selected channel seed", async () => {
	const oldest: CachedAggregateSeed = {
		topic: "channel:TWITCH:seeded-channel",
		aggregate: aggregate("0", "old-channel"),
		cursor: "1000-0",
	};
	const newest: CachedAggregateSeed = {
		topic: "channel:TWITCH:seeded-channel",
		aggregate: aggregate("0", "new-channel"),
		cursor: "1000-3",
	};
	const { broadcasts } = setupChrome(new Map([[8, newest]]));
	globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
	globalThis.fetch = (async (input) => {
		if (new URL(input.toString()).pathname.includes("/global/")) return Response.json(aggregate("999-0"));
		throw new Error("Channel HTTP must not run when a seed exists");
	}) as typeof fetch;

	const service = new EnhancerApiService(logger);
	await service.initialize(7, 0, "client-a", "twitch");
	FakeWebSocket.onSubscribe = (socket, _command, topic) => {
		queueMicrotask(() => socket.receive({ type: "subscription.confirmed", topic }));
		queueMicrotask(() =>
			socket.receive({
				type: "channel.unavailable",
				topic,
				reason: "archived",
				cursor: "1000-2",
			}),
		);
		queueMicrotask(() => socket.receive({ type: "replay.complete", topic }));
	};

	const result = await service.joinChannel(7, 0, "client-a", "twitch", "seeded-channel", oldest);
	expect(result?.cursor).toBe("1000-3");
	expect(result?.aggregate.accounts[0].accountId).toBe("new-channel");
	expect(
		broadcasts.some(
			(message) =>
				message.type === "enhancer-api-updated" && message.payload.topic === newest.topic && !message.payload.aggregate,
		),
	).toBe(false);
	service.disconnect(7, 0, "client-a", "twitch");
});

test("replays archive and restore availability in cursor order", async () => {
	const seed: CachedAggregateSeed = {
		topic: "channel:TWITCH:restored-channel",
		aggregate: aggregate("0", "before-archive"),
		cursor: "1100-0",
	};
	setupChrome(new Map([[8, seed]]));
	globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
	let channelRequests = 0;
	globalThis.fetch = (async (input) => {
		if (new URL(input.toString()).pathname.includes("/global/")) return Response.json(aggregate("1099-0"));
		channelRequests++;
		return Response.json(aggregate("1100-3", "after-restore"));
	}) as typeof fetch;

	const service = new EnhancerApiService(logger);
	await service.initialize(7, 0, "client-a", "twitch");
	let channelSubscriptions = 0;
	FakeWebSocket.onSubscribe = (socket, command, topic) => {
		channelSubscriptions++;
		queueMicrotask(() => socket.receive({ type: "subscription.confirmed", topic }));
		if (channelSubscriptions === 1) {
			queueMicrotask(() =>
				socket.receive({ type: "channel.unavailable", topic, reason: "archived", cursor: "1100-1" }),
			);
			queueMicrotask(() => socket.receive({ type: "channel.available", topic, reason: "restored", cursor: "1100-2" }));
		}
		queueMicrotask(() => socket.receive({ type: "replay.complete", topic }));
	};

	expect(await service.joinChannel(7, 0, "client-a", "twitch", "restored-channel", seed)).toBeNull();
	await waitForEvents();
	expect(channelRequests).toBe(1);
	expect(channelSubscriptions).toBe(2);
	service.disconnect(7, 0, "client-a", "twitch");
});

test("moves to a replacement topic when rename races the initial HTTP", async () => {
	setupChrome();
	globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
	let resolveOld: (response: Response) => void = () => {};
	const requests: string[] = [];
	globalThis.fetch = (async (input) => {
		const externalId = decodeURIComponent(new URL(input.toString()).pathname.split("/").at(-2) as string);
		requests.push(externalId);
		if (externalId === "old-race") {
			return new Promise<Response>((resolve) => {
				resolveOld = resolve;
			});
		}
		return Response.json(aggregate("1200-2", "replacement"));
	}) as typeof fetch;

	const service = new EnhancerApiService(logger);
	await service.initialize(7, 0, "client-a", "twitch");
	const pending = service.joinChannel(7, 0, "client-a", "twitch", "old-race");
	while (!requests.includes("old-race")) await Promise.resolve();
	FakeWebSocket.instance.receive({
		type: "channel.unavailable",
		topic: "channel:TWITCH:old-race",
		reason: "renamed",
		replacementTopic: "channel:TWITCH:new-race",
		cursor: "1200-1",
	});
	resolveOld(new Response(null, { status: 404 }));

	expect(await pending).toBeNull();
	await waitForEvents();
	expect(requests.filter((externalId) => externalId === "old-race")).toHaveLength(1);
	expect(requests.filter((externalId) => externalId === "new-race")).toHaveLength(1);
	expect(FakeWebSocket.commands.some((command) => command.subscription?.externalId === "new-race")).toBe(true);
	service.disconnect(7, 0, "client-a", "twitch");
});

test("keeps restore availability that arrives during archive broadcasting", async () => {
	let releaseBroadcast: () => void = () => {};
	let archiveBroadcastStarted = false;
	setupChrome(new Map(), async (message) => {
		if (message.type !== "enhancer-api-updated" || message.payload.aggregate) return;
		archiveBroadcastStarted = true;
		await new Promise<void>((resolve) => {
			releaseBroadcast = resolve;
		});
	});
	globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
	let channelRequests = 0;
	globalThis.fetch = (async (input) => {
		if (new URL(input.toString()).pathname.includes("/live-race/")) channelRequests++;
		return Response.json(aggregate(`${1300 + channelRequests}-0`, "restored-live"));
	}) as typeof fetch;

	const service = new EnhancerApiService(logger);
	await service.initialize(7, 0, "client-a", "twitch");
	await service.joinChannel(7, 0, "client-a", "twitch", "live-race");
	FakeWebSocket.instance.receive({
		type: "channel.unavailable",
		topic: "channel:TWITCH:live-race",
		reason: "archived",
		cursor: "1400-0",
	});
	while (!archiveBroadcastStarted) await Promise.resolve();
	FakeWebSocket.instance.receive({
		type: "channel.available",
		topic: "channel:TWITCH:live-race",
		reason: "restored",
		cursor: "1400-1",
	});
	releaseBroadcast();
	await waitForEvents();

	expect(channelRequests).toBe(2);
	service.disconnect(7, 0, "client-a", "twitch");
});
