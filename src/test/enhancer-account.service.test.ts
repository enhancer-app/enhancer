import { afterEach, expect, test } from "bun:test";
import { ENHANCER_ENDPOINTS, resolveApiEnvironment } from "$shared/enhancer-environment.ts";
import { sanitizeGlobalSettings } from "$shared/settings/global-settings.constants.ts";
import type { Logger } from "$shared/logger/logger.ts";
import { EnhancerAccountService } from "$shared/worker/enhancer-account/enhancer-account.service.ts";
import { base64UrlEncode } from "$shared/worker/enhancer-account/pkce.ts";
import type { EnhancerApiEnvironment } from "$types/shared/enhancer-environment.types.ts";
import type {
	AccountSessionStore,
	EnhancerAccountBroadcastPayload,
	IdentityApi,
	StoredAccountSession,
} from "$types/shared/worker/enhancer-account-worker.types.ts";

const logger = { debug() {}, info() {}, warn() {}, error() {} } as unknown as Logger;
const originalFetch = globalThis.fetch;
const REDIRECT = "https://fpakolililnggchpbledojdijcogodgb.chromiumapp.org/";

afterEach(() => {
	globalThis.fetch = originalFetch;
});

class MemoryAccountStore implements AccountSessionStore {
	sessions = new Map<EnhancerApiEnvironment, StoredAccountSession>();
	key: CryptoKey | undefined;

	async getSession(environment: EnhancerApiEnvironment) {
		return this.sessions.get(environment);
	}
	async putSession(session: StoredAccountSession) {
		this.sessions.set(session.environment, session);
	}
	async deleteSession(environment: EnhancerApiEnvironment) {
		this.sessions.delete(environment);
	}
	async getKey() {
		return this.key;
	}
	async putKey(key: CryptoKey) {
		this.key = key;
	}
}

type Call = { url: string; init: RequestInit };

function jwt(claims: Record<string, unknown>): string {
	const encode = (value: unknown) => base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
	return `${encode({ alg: "RS256" })}.${encode(claims)}.signature`;
}

function tokens(accessToken: string, extra: Record<string, unknown> = {}) {
	return {
		access_token: accessToken,
		refresh_token: `refresh-${accessToken}`,
		expires_in: 300,
		token_type: "Bearer",
		...extra,
	};
}

function createIdentity(respond: (authorizeUrl: URL) => string): IdentityApi {
	return {
		getRedirectURL: () => REDIRECT,
		launchWebAuthFlow: async ({ url }) => respond(new URL(url)),
	} as IdentityApi;
}

function approve(authorizeUrl: URL): string {
	return `${REDIRECT}?code=auth-code&state=${authorizeUrl.searchParams.get("state")}`;
}

function setup(environment: EnhancerApiEnvironment, identity = createIdentity(approve)) {
	const store = new MemoryAccountStore();
	const broadcasts: EnhancerAccountBroadcastPayload[] = [];
	const service = new EnhancerAccountService(
		logger,
		store,
		environment,
		() => identity,
		async (payload) => {
			broadcasts.push(payload);
		},
	);
	return { store, broadcasts, service };
}

function mockFetch(handler: (url: string, init: RequestInit) => Response | Promise<Response>): Call[] {
	const calls: Call[] = [];
	globalThis.fetch = Object.assign(
		async (input: string | URL | Request, init: RequestInit = {}) => {
			const url = input instanceof Request ? input.url : String(input);
			calls.push({ url, init });
			return handler(url, init);
		},
		{ preconnect: originalFetch.preconnect },
	);
	return calls;
}

function form(call: Call): URLSearchParams {
	return new URLSearchParams(String(call.init.body));
}

test("logs in against the selected realm and keeps the session encrypted", async () => {
	let challenge: string | null = null;
	const { service, store } = setup(
		"test",
		createIdentity((url) => {
			challenge = url.searchParams.get("code_challenge");
			expect(url.origin + url.pathname).toBe(`${ENHANCER_ENDPOINTS.test.issuer}/protocol/openid-connect/auth`);
			expect(url.searchParams.get("client_id")).toBe("enhancer-extension");
			expect(url.searchParams.get("code_challenge_method")).toBe("S256");
			return approve(url);
		}),
	);
	const calls = mockFetch(() =>
		Response.json(tokens("access-1", { id_token: jwt({ sub: "user-1", name: "Streamer", preferred_username: "s1" }) })),
	);

	const result = await service.login();

	expect(result).toEqual({
		success: true,
		account: { loggedIn: true, environment: "test", displayName: "Streamer", username: "s1" },
	});
	expect(calls[0].url).toBe(`${ENHANCER_ENDPOINTS.test.issuer}/protocol/openid-connect/token`);
	const exchange = form(calls[0]);
	expect(exchange.get("code")).toBe("auth-code");
	expect(exchange.get("redirect_uri")).toBe(REDIRECT);
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(exchange.get("code_verifier") ?? ""));
	expect(base64UrlEncode(new Uint8Array(digest))).toBe(challenge as unknown as string);

	const stored = store.sessions.get("test");
	expect(stored).toBeDefined();
	expect(new TextDecoder().decode(stored?.data)).not.toContain("access-1");
	expect(store.sessions.has("production")).toBe(false);
});

test("rejects a callback with another state and stores nothing", async () => {
	const { service, store } = setup(
		"test",
		createIdentity(() => `${REDIRECT}?code=stolen&state=forged`),
	);
	const calls = mockFetch(() => Response.json(tokens("never")));

	const result = await service.login();

	expect(result).toEqual({ success: false, reason: "failed", message: "Authorization state mismatch" });
	expect(calls).toHaveLength(0);
	expect(store.sessions.size).toBe(0);
});

test("refreshes once after a 401 and retries with the new token on the selected API", async () => {
	const { service } = setup("test");
	let accessIssued = 0;
	const calls = mockFetch((url, init) => {
		if (url.endsWith("/token")) return Response.json(tokens(`access-${++accessIssued}`));
		const auth = new Headers(init.headers).get("Authorization");
		return auth === "Bearer access-2" ? Response.json({ ok: true }) : new Response(null, { status: 401 });
	});
	await service.login();

	const result = await service.authorizedFetch("/v1/me/badges");

	expect(result.kind).toBe("response");
	const apiCalls = calls.filter((call) => call.url.startsWith(ENHANCER_ENDPOINTS.test.api));
	expect(apiCalls.map((call) => call.url)).toEqual([
		"https://test-api.enhancer.at/v1/me/badges",
		"https://test-api.enhancer.at/v1/me/badges",
	]);
	const refresh = calls.filter((call) => call.url.endsWith("/token"))[1];
	expect(form(refresh).get("grant_type")).toBe("refresh_token");
	expect(form(refresh).get("refresh_token")).toBe("refresh-access-1");
});

test("drops the session when the refresh token is rejected", async () => {
	const { service, store, broadcasts } = setup("production");
	let tokenCalls = 0;
	mockFetch((url) => {
		if (url.endsWith("/token")) {
			tokenCalls++;
			return tokenCalls === 1
				? Response.json(tokens("access-1"))
				: Response.json({ error: "invalid_grant" }, { status: 400 });
		}
		return new Response(null, { status: 401 });
	});
	await service.login();

	expect(await service.authorizedFetch("/v1/me")).toEqual({ kind: "unauthenticated" });
	expect(store.sessions.size).toBe(0);
	expect(broadcasts.at(-1)).toEqual({ account: { loggedIn: false, environment: "production" } });
});

test("keeps production and test sessions apart", async () => {
	const { service } = setup("test");
	mockFetch(() => Response.json(tokens("test-access")));
	await service.login();

	await service.setEnvironment("production");
	expect(await service.getAccount()).toEqual({ loggedIn: false, environment: "production" });
	expect(await service.authorizedFetch("/v1/me")).toEqual({ kind: "unauthenticated" });

	await service.setEnvironment("test");
	expect((await service.getAccount()).loggedIn).toBe(true);
});

test("logout deletes the session and revokes the refresh token", async () => {
	const { service, store } = setup("test");
	const calls = mockFetch((url) => (url.endsWith("/token") ? Response.json(tokens("access-1")) : new Response(null)));
	await service.login();

	await service.logout();

	expect(store.sessions.size).toBe(0);
	const revoke = calls.at(-1) as Call;
	expect(revoke.url).toBe(`${ENHANCER_ENDPOINTS.test.issuer}/protocol/openid-connect/revoke`);
	expect(form(revoke).get("token")).toBe("refresh-access-1");
});

test("only preview builds can select the test API", () => {
	expect(resolveApiEnvironment("test", true)).toBe("test");
	expect(resolveApiEnvironment("test", false)).toBe("production");
	expect(resolveApiEnvironment("staging", true)).toBe("production");
	expect(sanitizeGlobalSettings({ apiEnvironment: "test" })).toEqual({ apiEnvironment: "test" });
	expect(sanitizeGlobalSettings({ apiEnvironment: "staging" })).toEqual({});
});

test("reports an auth page that fails to load as an error, but a closed window as cancelled", async () => {
	const failing = setup("test", {
		getRedirectURL: () => REDIRECT,
		launchWebAuthFlow: async () => {
			throw new Error("Authorization page could not be loaded.");
		},
	} as IdentityApi);
	expect(await failing.service.login()).toMatchObject({ success: false, reason: "failed" });
	expect(failing.broadcasts.at(-1)?.error).toBe("Authorization page could not be loaded.");

	const closed = setup("test", {
		getRedirectURL: () => REDIRECT,
		launchWebAuthFlow: async () => {
			throw new Error("The user did not approve access.");
		},
	} as IdentityApi);
	expect(await closed.service.login()).toMatchObject({ success: false, reason: "cancelled" });
	expect(closed.broadcasts.at(-1)?.error).toBeUndefined();
});
