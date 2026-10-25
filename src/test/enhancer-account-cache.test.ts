import { expect, test } from "bun:test";
import type { Logger } from "$shared/logger/logger.ts";
import { EnhancerAccountCache } from "$shared/worker/enhancer-account/enhancer-account.cache.ts";
import { EnhancerAccountCardHandler } from "$shared/worker/enhancer-account/enhancer-account-card.handler.ts";
import type { EnhancerAccountService } from "$shared/worker/enhancer-account/enhancer-account.service.ts";
import { EnhancerProfileService } from "$shared/worker/enhancer-account/enhancer-profile.service.ts";
import type { EnhancerViewerSummary } from "$types/apis/enhancer-account.apis.ts";
import type {
	AccountCacheStorage,
	AuthorizedRequestResult,
	EnhancerAccountState,
} from "$types/shared/worker/enhancer-account-worker.types.ts";

const logger = { debug() {}, info() {}, warn() {}, error() {} } as unknown as Logger;

const summary = (avatarUrl: string): EnhancerViewerSummary => ({
	user: {
		id: "user-1",
		username: "igorovh",
		displayName: "igorovh",
		primaryProvider: "twitch",
		avatarUrl,
		createdAt: "2026-01-01T00:00:00.000Z",
	},
	identities: [],
});

function memoryStorage(): AccountCacheStorage & { data: Map<string, unknown> } {
	const data = new Map<string, unknown>();
	return {
		data,
		get: async (key) => structuredClone(data.get(key)),
		set: async (key, value) => void data.set(key, structuredClone(value)),
		remove: async (key) => void data.delete(key),
	};
}

function setup() {
	const state = {
		owner: "production:user-1" as string | null,
		account: { loggedIn: true, environment: "production", displayName: "igorovh" } as EnhancerAccountState,
		avatar: "https://cdn/a.png",
		status: 200,
		requests: 0,
		notified: 0,
	};
	const accountService = {
		getAccount: async () => state.account,
		getCacheOwner: async () => state.owner,
		notifyAccountChanged: async () => void state.notified++,
		authorizedFetch: async (path: string): Promise<AuthorizedRequestResult> => {
			state.requests++;
			if (state.status === 401) return { kind: "unauthenticated" };
			const body = path === "/v1/me" ? summary(state.avatar) : { global: [], channels: [] };
			return { kind: "response", response: new Response(JSON.stringify(body), { status: state.status }) };
		},
	} as unknown as EnhancerAccountService;
	const storage = memoryStorage();
	const profiles = new EnhancerProfileService(logger, accountService, new EnhancerAccountCache(storage));
	return { state, storage, profiles, accountService };
}

test("keeps the last profile per account and drops it for another account or an expired session", async () => {
	const { state, profiles, storage } = setup();
	await profiles.getProfile();
	expect((await profiles.getCached()).profile?.user.avatarUrl).toBe("https://cdn/a.png");

	state.owner = "production:user-2";
	expect((await profiles.getCached()).profile).toBeUndefined();

	state.owner = "production:user-1";
	state.status = 401;
	await profiles.getBadges();
	expect(storage.data.size).toBe(0);

	state.status = 200;
	await profiles.getProfile();
	state.owner = null;
	expect((await profiles.getCached()).profile).toBeUndefined();
	expect(storage.data.size).toBe(0);
});

test("the account card answers from the cache and refreshes stale data in the background", async () => {
	const { state, profiles, accountService } = setup();
	let now = 1_000_000;
	const handler = new EnhancerAccountCardHandler(logger, accountService, profiles, () => now);

	const first = await handler.handle({ platform: "twitch" });
	expect(first).toMatchObject({ loggedIn: true, displayName: "igorovh", avatarUrl: null, badgesLoaded: false });
	await handler.waitForRefresh();
	expect(state.notified).toBe(1);

	now = Date.now();
	const second = await handler.handle({ platform: "twitch" });
	expect(second).toMatchObject({ avatarUrl: "https://cdn/a.png", badgesLoaded: true });
	const requests = state.requests;
	await handler.waitForRefresh();
	expect(state.requests).toBe(requests);

	now += 120_000;
	await handler.handle({ platform: "twitch" });
	await handler.waitForRefresh();
	expect(state.requests).toBe(requests + 2);
	expect(state.notified).toBe(1);
});

test("a logged-out account gets the login card without any request", async () => {
	const { state, profiles, accountService } = setup();
	state.account = { loggedIn: false, environment: "production" };
	const handler = new EnhancerAccountCardHandler(logger, accountService, profiles);
	expect((await handler.handle({ platform: "twitch" })).loggedIn).toBe(false);
	expect(state.requests).toBe(0);
});
