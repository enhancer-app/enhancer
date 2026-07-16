import { afterEach, expect, test } from "bun:test";
import type { Logger } from "$shared/logger/logger.ts";
import { EnhancerApiService } from "$shared/worker/enhancer-api/enhancer-api.service.ts";
import type { WorkerBroadcast } from "$types/shared/worker/worker.types.ts";

const originalChrome = globalThis.chrome;
const originalFetch = globalThis.fetch;
const originalWebSocket = globalThis.WebSocket;

afterEach(() => {
	globalThis.chrome = originalChrome;
	globalThis.fetch = originalFetch;
	globalThis.WebSocket = originalWebSocket;
});

test("shares one WebSocket and topics between clients", async () => {
	const broadcasts: WorkerBroadcast[] = [];
	const storage = new Map<string, string>();
	let closeTab: (tabId: number) => void = () => {};
	globalThis.chrome = {
		storage: {
			session: {
				get: async (key: string) => (storage.has(key) ? { [key]: storage.get(key) } : {}),
				set: async (items: Record<string, string>) => {
					for (const [key, value] of Object.entries(items)) storage.set(key, value);
				},
				remove: async (key: string) => {
					storage.delete(key);
				},
			},
		},
		tabs: {
			onRemoved: {
				addListener: (listener: (tabId: number) => void) => {
					closeTab = listener;
				},
			},
			sendMessage: async (_tabId: number, message: WorkerBroadcast) => broadcasts.push(message),
		},
	} as unknown as typeof chrome;

	class FakeWebSocket extends EventTarget {
		static readonly OPEN = 1;
		static instance: FakeWebSocket;
		static instances = 0;
		static commands: any[] = [];
		readonly readyState = FakeWebSocket.OPEN;

		constructor(_url: string) {
			super();
			FakeWebSocket.instance = this;
			FakeWebSocket.instances++;
			queueMicrotask(() => this.receive({ type: "connection.ready" }));
		}

		send(data: string): void {
			const command = JSON.parse(data);
			FakeWebSocket.commands.push(command);
			if (command.type === "subscribe") {
				const { subscription } = command;
				const suffix = subscription.externalId ? `:${subscription.externalId.toLowerCase()}` : "";
				const topic = `${subscription.scope.toLowerCase()}:${subscription.platform}${suffix}`;
				queueMicrotask(() => this.receive({ type: "subscription.confirmed", topic }));
			}
		}

		close(): void {
			this.dispatchEvent(new Event("close"));
		}

		receive(message: object): void {
			this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(message) }));
		}
	}

	globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;

	const requests: Array<{ page: string | null; etag: string | null }> = [];
	globalThis.fetch = (async (input, init) => {
		const url = new URL(input.toString());
		const page = url.searchParams.get("page");
		const headers = new Headers(init?.headers);
		const etag = headers.get("If-None-Match");
		requests.push({ page, etag });
		if (etag) return new Response(null, { status: 304, headers: { ETag: etag } });
		const body = {
			channelId: null,
			platform: "TWITCH",
			accounts: [
				{
					accountId: `account-${page}`,
					externalId: page === "0" ? "100" : "200",
					badgesIds: ["badge"],
					customNickname: null,
					customFont: null,
					hasGlow: false,
				},
			],
			badges: [{ badgeId: "badge", sources: { "18x18": "badge.webp" }, name: `Badge ${page}`, priority: 1 }],
			page: Number(page),
			hasNextPage: page === "0",
		};
		return Response.json(body, { headers: { ETag: `etag-${page}` } });
	}) as typeof fetch;

	const logger = { debug() {}, info() {}, warn() {}, error() {} } as unknown as Logger;
	const service = new EnhancerApiService(logger);
	const aggregate = await service.initialize(7, 0, "client-a", "twitch");
	await service.initialize(8, 0, "client-b", "twitch");
	expect(FakeWebSocket.instances).toBe(1);
	expect(
		FakeWebSocket.commands.filter((command) => command.type === "subscribe" && command.subscription.scope === "GLOBAL"),
	).toHaveLength(1);
	expect(aggregate.accounts).toHaveLength(2);
	expect(aggregate.badges).toEqual([
		{ badgeId: "badge", sources: { "18x18": "badge.webp" }, name: "Badge 1", priority: 1 },
	]);

	FakeWebSocket.instance.receive({
		type: "badge.updated",
		platform: "TWITCH",
		badgeId: "badge",
		changes: { priority: 2 },
		cursor: "1720953600000-0",
	});
	await new Promise((resolve) => setTimeout(resolve, 10));
	const requestCount = requests.length;
	FakeWebSocket.instance.receive({
		type: "badge.updated",
		platform: "TWITCH",
		badgeId: "badge",
		changes: { priority: 2 },
		cursor: "1720953600000-0",
	});
	await new Promise((resolve) => setTimeout(resolve, 10));

	expect(requests.slice(2)).toEqual([
		{ page: "0", etag: "etag-0" },
		{ page: "1", etag: "etag-1" },
	]);
	expect(requests).toHaveLength(requestCount);
	expect(broadcasts.some((message) => message.type === "enhancer-api-updated")).toBe(true);

	await service.joinChannel(7, 0, "client-a", "twitch", "100");
	await service.joinChannel(8, 0, "client-b", "twitch", "200");
	await service.initialize(9, 0, "client-c", "twitch");
	await service.joinChannel(9, 0, "client-c", "twitch", "100");
	const channelSubscriptions = FakeWebSocket.commands.filter(
		(command) => command.type === "subscribe" && command.subscription.scope === "CHANNEL",
	);
	expect(channelSubscriptions.map((command) => command.subscription.externalId)).toEqual(["100", "200"]);

	broadcasts.length = 0;
	FakeWebSocket.instance.receive({
		type: "message",
		target: { scope: "CHANNEL", platform: "TWITCH", externalId: "100" },
		name: "channel.message",
		data: { text: "Hello" },
		cursor: "1720953600001-0",
	});
	await new Promise((resolve) => setTimeout(resolve, 10));
	expect(
		broadcasts
			.filter((message) => message.type === "enhancer-api-message")
			.map((message) => message.payload.clientId)
			.sort(),
	).toEqual(["client-a", "client-c"]);

	service.disconnect(7, 0, "client-a", "twitch");
	expect(
		FakeWebSocket.commands.filter(
			(command) => command.type === "unsubscribe" && command.subscription.externalId === "100",
		),
	).toHaveLength(0);
	service.disconnect(9, 0, "client-c", "twitch");
	expect(
		FakeWebSocket.commands.filter(
			(command) => command.type === "unsubscribe" && command.subscription.externalId === "100",
		),
	).toHaveLength(1);
	closeTab(8);
});
