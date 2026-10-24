import { ENHANCER_ENDPOINTS } from "$shared/enhancer-environment.ts";
import type { Logger } from "$shared/logger/logger.ts";
import {
	isEnhancerAccountSession,
	isOidcErrorResponse,
	isOidcTokenResponse,
} from "$shared/worker/enhancer-account/enhancer-account.guards.ts";
import {
	createPkceChallenge,
	createRandomString,
	decodeJwtClaims,
	parseAuthorizationCallback,
} from "$shared/worker/enhancer-account/pkce.ts";
import type { OidcTokenResponse } from "$types/apis/enhancer-account.apis.ts";
import type { EnhancerApiEnvironment, EnhancerEndpoints } from "$types/shared/enhancer-environment.types.ts";
import type {
	AccountSessionStore,
	AuthorizationRequest,
	AuthorizedRequestResult,
	EnhancerAccountBroadcastPayload,
	EnhancerAccountProfile,
	EnhancerAccountSession,
	EnhancerAccountState,
	IdentityApi,
	LoginEnhancerAccountResponse,
} from "$types/shared/worker/enhancer-account-worker.types.ts";
import type { WorkerBroadcast } from "$types/shared/worker/worker.types.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const REQUEST_TIMEOUT_MS = 15_000;

export class EnhancerAccountService {
	static readonly CLIENT_ID = "enhancer-extension";
	static readonly SCOPE = "openid";
	private static readonly EXPIRY_MARGIN_MS = 30_000;

	private refreshPromise: Promise<EnhancerAccountSession | null> | null = null;
	private loginPromise: Promise<LoginEnhancerAccountResponse> | null = null;
	private key: Promise<CryptoKey> | null = null;

	constructor(
		private readonly logger: Logger,
		private readonly store: AccountSessionStore,
		private environment: EnhancerApiEnvironment = "production",
		private readonly identity: () => IdentityApi | undefined = getBrowserIdentity,
		private readonly broadcastState: (payload: EnhancerAccountBroadcastPayload) => Promise<void> = broadcastToTabs,
	) {}

	get endpoints(): EnhancerEndpoints {
		return ENHANCER_ENDPOINTS[this.environment];
	}

	async setEnvironment(environment: EnhancerApiEnvironment): Promise<void> {
		if (environment === this.environment) return;
		this.environment = environment;
		this.refreshPromise = null;
		await this.broadcast({ account: await this.getAccount() });
	}

	async getAccount(): Promise<EnhancerAccountState> {
		return this.toState(await this.readSession());
	}

	login(): Promise<LoginEnhancerAccountResponse> {
		if (!this.loginPromise) {
			this.loginPromise = this.performLogin().finally(() => {
				this.loginPromise = null;
			});
		}
		return this.loginPromise;
	}

	async logout(): Promise<void> {
		const session = await this.readSession();
		await this.store.deleteSession(this.environment);
		await this.broadcast({ account: this.toState(null) });
		if (!session?.refreshToken) return;
		try {
			await fetch(this.endpoint("revoke"), {
				method: "POST",
				credentials: "omit",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					client_id: EnhancerAccountService.CLIENT_ID,
					token: session.refreshToken,
					token_type_hint: "refresh_token",
				}),
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			});
		} catch (error) {
			this.logger.warn("Enhancer account token revocation failed:", error);
		}
	}

	async authorizedFetch(path: string, init: RequestInit = {}): Promise<AuthorizedRequestResult> {
		const url = new URL(path, this.endpoints.api).toString();
		try {
			let session = await this.getValidSession();
			if (!session) return { kind: "unauthenticated" };
			let response = await this.fetchWithToken(url, init, session.accessToken);
			if (response.status !== 401) return { kind: "response", response };
			session = await this.refresh(session);
			if (!session) return { kind: "unauthenticated" };
			response = await this.fetchWithToken(url, init, session.accessToken);
			if (response.status === 401) return { kind: "unauthenticated" };
			return { kind: "response", response };
		} catch (error) {
			return { kind: "network-error", message: error instanceof Error ? error.message : String(error) };
		}
	}

	createAuthorizationRequest(
		redirectUri: string,
		pkce: { verifier: string; challenge: string },
		state = createRandomString(16),
		nonce = createRandomString(16),
	): AuthorizationRequest {
		const url = new URL(this.endpoint("auth"));
		url.searchParams.set("client_id", EnhancerAccountService.CLIENT_ID);
		url.searchParams.set("response_type", "code");
		url.searchParams.set("redirect_uri", redirectUri);
		url.searchParams.set("scope", EnhancerAccountService.SCOPE);
		url.searchParams.set("state", state);
		url.searchParams.set("nonce", nonce);
		url.searchParams.set("code_challenge", pkce.challenge);
		url.searchParams.set("code_challenge_method", "S256");
		url.searchParams.set("prompt", "login");
		return { url: url.toString(), state, nonce, verifier: pkce.verifier, redirectUri };
	}

	private async performLogin(): Promise<LoginEnhancerAccountResponse> {
		const identity = this.identity();
		if (!identity) return this.failLogin("failed", "Browser identity API is unavailable");
		const environment = this.environment;
		try {
			const pkce = await createPkceChallenge();
			const request = this.createAuthorizationRequest(identity.getRedirectURL(), pkce);
			let callbackUrl: string | undefined;
			try {
				callbackUrl = await identity.launchWebAuthFlow({ url: request.url, interactive: true });
			} catch (error) {
				const message = error instanceof Error ? error.message : "Login was cancelled";
				return this.failLogin(/did not approve|cancel/i.test(message) ? "cancelled" : "failed", message);
			}
			if (!callbackUrl) return this.failLogin("cancelled", "Login was cancelled");
			const callback = parseAuthorizationCallback(callbackUrl, request.state);
			if ("error" in callback) return this.failLogin(callback.cancelled ? "cancelled" : "failed", callback.error);
			const tokens = await this.requestTokens({
				grant_type: "authorization_code",
				code: callback.code,
				redirect_uri: request.redirectUri,
				client_id: EnhancerAccountService.CLIENT_ID,
				code_verifier: request.verifier,
			});
			if (!tokens) return this.failLogin("failed", "Token exchange failed");
			const claims = tokens.id_token ? decodeJwtClaims(tokens.id_token) : null;
			if (claims?.nonce !== undefined && claims.nonce !== request.nonce) {
				return this.failLogin("failed", "ID token nonce mismatch");
			}
			if (environment !== this.environment) return this.failLogin("failed", "API environment changed during login");
			const session = this.createSession(tokens, null);
			await this.writeSession(session, environment);
			const account = this.toState(session);
			await this.broadcast({ account });
			this.logger.info("Enhancer account logged in");
			return { success: true, account };
		} catch (error) {
			return this.failLogin("failed", error instanceof Error ? error.message : String(error));
		}
	}

	private async failLogin(reason: "cancelled" | "failed", message: string): Promise<LoginEnhancerAccountResponse> {
		this.logger.warn(`Enhancer account login ${reason}: ${message}`);
		await this.broadcast({ account: await this.getAccount(), error: reason === "cancelled" ? undefined : message });
		return { success: false, reason, message };
	}

	private async getValidSession(): Promise<EnhancerAccountSession | null> {
		const session = await this.readSession();
		if (!session) return null;
		if (session.expiresAt - EnhancerAccountService.EXPIRY_MARGIN_MS > Date.now()) return session;
		return this.refresh(session);
	}

	private refresh(session: EnhancerAccountSession): Promise<EnhancerAccountSession | null> {
		if (!this.refreshPromise) {
			this.refreshPromise = this.performRefresh(session).finally(() => {
				this.refreshPromise = null;
			});
		}
		return this.refreshPromise;
	}

	private async performRefresh(session: EnhancerAccountSession): Promise<EnhancerAccountSession | null> {
		const environment = this.environment;
		if (!session.refreshToken || (session.refreshExpiresAt !== null && session.refreshExpiresAt <= Date.now())) {
			await this.expireSession(environment);
			return null;
		}
		const tokens = await this.requestTokens({
			grant_type: "refresh_token",
			refresh_token: session.refreshToken,
			client_id: EnhancerAccountService.CLIENT_ID,
		});
		if (!tokens) {
			await this.expireSession(environment);
			return null;
		}
		const refreshed = this.createSession(tokens, session);
		await this.writeSession(refreshed, environment);
		return environment === this.environment ? refreshed : null;
	}

	private async expireSession(environment: EnhancerApiEnvironment): Promise<void> {
		await this.store.deleteSession(environment);
		if (environment === this.environment) await this.broadcast({ account: this.toState(null) });
	}

	private async requestTokens(params: Record<string, string>): Promise<OidcTokenResponse | null> {
		const response = await fetch(this.endpoint("token"), {
			method: "POST",
			credentials: "omit",
			headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
			body: new URLSearchParams(params),
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		const body: unknown = await response.json().catch(() => null);
		if (response.ok && isOidcTokenResponse(body)) return body;
		const error = isOidcErrorResponse(body) ? body.error : `status ${response.status}`;
		this.logger.warn(`Token request (${params.grant_type}) failed: ${error}`);
		if (response.status === 400 || response.status === 401) return null;
		throw new Error(`Token request failed: ${error}`);
	}

	private createSession(tokens: OidcTokenResponse, previous: EnhancerAccountSession | null): EnhancerAccountSession {
		const now = Date.now();
		const idToken = tokens.id_token ?? previous?.idToken ?? null;
		return {
			accessToken: tokens.access_token,
			refreshToken: tokens.refresh_token ?? previous?.refreshToken ?? null,
			idToken,
			expiresAt: now + tokens.expires_in * 1000,
			refreshExpiresAt: tokens.refresh_expires_in ? now + tokens.refresh_expires_in * 1000 : null,
			profile: this.readProfile(idToken ?? tokens.access_token, previous?.profile),
		};
	}

	private readProfile(token: string, fallback?: EnhancerAccountProfile): EnhancerAccountProfile {
		const claims = decodeJwtClaims(token);
		if (!claims) return fallback ?? { subject: null, displayName: null, username: null };
		return {
			subject: claims.sub ?? null,
			displayName: claims.name ?? claims.given_name ?? claims.preferred_username ?? null,
			username: claims.preferred_username ?? null,
		};
	}

	private toState(session: EnhancerAccountSession | null): EnhancerAccountState {
		if (!session) return { loggedIn: false, environment: this.environment };
		return {
			loggedIn: true,
			environment: this.environment,
			...(session.profile.displayName ? { displayName: session.profile.displayName } : {}),
			...(session.profile.username ? { username: session.profile.username } : {}),
		};
	}

	private fetchWithToken(url: string, init: RequestInit, accessToken: string): Promise<Response> {
		const headers = new Headers(init.headers);
		headers.set("Authorization", `Bearer ${accessToken}`);
		return fetch(url, { ...init, headers, credentials: "omit", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
	}

	private async readSession(): Promise<EnhancerAccountSession | null> {
		try {
			const stored = await this.store.getSession(this.environment);
			if (!stored) return null;
			const data = await crypto.subtle.decrypt({ name: "AES-GCM", iv: stored.iv }, await this.getKey(), stored.data);
			const session: unknown = JSON.parse(decoder.decode(data));
			return isEnhancerAccountSession(session) ? session : null;
		} catch (error) {
			this.logger.warn("Failed to read Enhancer account session:", error);
			return null;
		}
	}

	private async writeSession(session: EnhancerAccountSession, environment: EnhancerApiEnvironment): Promise<void> {
		const iv = crypto.getRandomValues(new Uint8Array(12));
		const data = await crypto.subtle.encrypt(
			{ name: "AES-GCM", iv },
			await this.getKey(),
			encoder.encode(JSON.stringify(session)),
		);
		await this.store.putSession({ environment, iv, data, savedAt: Date.now() });
	}

	private getKey(): Promise<CryptoKey> {
		this.key ??= this.loadKey().catch((error) => {
			this.key = null;
			throw error;
		});
		return this.key;
	}

	private async loadKey(): Promise<CryptoKey> {
		const existing = await this.store.getKey();
		if (existing) return existing;
		const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
		await this.store.putKey(key);
		return key;
	}

	private async broadcast(payload: EnhancerAccountBroadcastPayload): Promise<void> {
		try {
			await this.broadcastState(payload);
		} catch (error) {
			this.logger.warn("Failed to broadcast Enhancer account state:", error);
		}
	}

	private endpoint(name: "auth" | "token" | "revoke"): string {
		return `${this.endpoints.issuer}/protocol/openid-connect/${name}`;
	}
}

function getBrowserIdentity(): IdentityApi | undefined {
	const scoped = globalThis as typeof globalThis & { browser?: { identity?: IdentityApi } };
	if (scoped.browser?.identity) return scoped.browser.identity;
	return typeof chrome === "undefined" ? undefined : chrome.identity;
}

async function broadcastToTabs(payload: EnhancerAccountBroadcastPayload): Promise<void> {
	const broadcast: WorkerBroadcast = { type: "enhancer-account-updated", payload };
	for (const tab of await chrome.tabs.query({})) {
		if (tab.id) chrome.tabs.sendMessage(tab.id, broadcast).catch(() => {});
	}
	chrome.runtime.sendMessage(broadcast).catch(() => {});
}
