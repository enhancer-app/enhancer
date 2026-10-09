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
import type {
	AuthorizationRequest,
	AuthorizedRequestResult,
	EnhancerAccountProfile,
	EnhancerAccountSession,
	EnhancerAccountState,
	LoginEnhancerAccountResponse,
} from "$types/shared/worker/enhancer-account-worker.types.ts";
import type { WorkerBroadcast } from "$types/shared/worker/worker.types.ts";

export class EnhancerAccountService {
	static readonly ISSUER = "https://auth.enhancer.at/realms/enhancer";
	static readonly CLIENT_ID = "enhancer-extension";
	static readonly SCOPE = "openid";
	private static readonly STORAGE_KEY = "enhancer.account.session";
	private static readonly EXPIRY_MARGIN_MS = 30_000;

	private refreshPromise: Promise<EnhancerAccountSession | null> | null = null;
	private loginPromise: Promise<LoginEnhancerAccountResponse> | null = null;

	constructor(private readonly logger: Logger) {}

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
		await chrome.storage.local.remove(EnhancerAccountService.STORAGE_KEY);
		await this.broadcast({ account: { loggedIn: false } });
		if (!session?.refreshToken) return;
		try {
			await fetch(this.endpoint("revoke"), {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					client_id: EnhancerAccountService.CLIENT_ID,
					token: session.refreshToken,
					token_type_hint: "refresh_token",
				}),
			});
		} catch (error) {
			this.logger.warn("Enhancer account logout request failed:", error);
		}
	}

	async authorizedFetch(url: string, init: RequestInit = {}): Promise<AuthorizedRequestResult> {
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
		return { url: url.toString(), state, nonce, verifier: pkce.verifier, redirectUri };
	}

	private async performLogin(): Promise<LoginEnhancerAccountResponse> {
		const identity = this.getIdentityApi();
		if (!identity) return this.failLogin("failed", "Browser identity API is unavailable");
		try {
			const pkce = await createPkceChallenge();
			const request = this.createAuthorizationRequest(identity.getRedirectURL(), pkce);
			let callbackUrl: string | undefined;
			try {
				callbackUrl = await identity.launchWebAuthFlow({ url: request.url, interactive: true });
			} catch (error) {
				return this.failLogin("cancelled", error instanceof Error ? error.message : "Login was cancelled");
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
			const session = this.createSession(tokens, null);
			await this.writeSession(session);
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
		if (!session.refreshToken || (session.refreshExpiresAt !== null && session.refreshExpiresAt <= Date.now())) {
			await this.expireSession();
			return null;
		}
		const tokens = await this.requestTokens({
			grant_type: "refresh_token",
			refresh_token: session.refreshToken,
			client_id: EnhancerAccountService.CLIENT_ID,
		});
		if (!tokens) {
			await this.expireSession();
			return null;
		}
		const refreshed = this.createSession(tokens, session);
		await this.writeSession(refreshed);
		return refreshed;
	}

	private async expireSession(): Promise<void> {
		await chrome.storage.local.remove(EnhancerAccountService.STORAGE_KEY);
		await this.broadcast({ account: { loggedIn: false } });
	}

	private async requestTokens(params: Record<string, string>): Promise<OidcTokenResponse | null> {
		const response = await fetch(this.endpoint("token"), {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
			body: new URLSearchParams(params),
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
		if (!session) return { loggedIn: false };
		return {
			loggedIn: true,
			...(session.profile.displayName ? { displayName: session.profile.displayName } : {}),
			...(session.profile.username ? { username: session.profile.username } : {}),
		};
	}

	private fetchWithToken(url: string, init: RequestInit, accessToken: string): Promise<Response> {
		const headers = new Headers(init.headers);
		headers.set("Authorization", `Bearer ${accessToken}`);
		return fetch(url, { ...init, headers });
	}

	private async readSession(): Promise<EnhancerAccountSession | null> {
		try {
			const result = await chrome.storage.local.get(EnhancerAccountService.STORAGE_KEY);
			const session: unknown = result[EnhancerAccountService.STORAGE_KEY];
			return isEnhancerAccountSession(session) ? session : null;
		} catch (error) {
			this.logger.warn("Failed to read Enhancer account session:", error);
			return null;
		}
	}

	private async writeSession(session: EnhancerAccountSession): Promise<void> {
		await chrome.storage.local.set({ [EnhancerAccountService.STORAGE_KEY]: session });
	}

	private async broadcast(payload: Extract<WorkerBroadcast, { type: "enhancer-account-updated" }>["payload"]) {
		const broadcast: WorkerBroadcast = { type: "enhancer-account-updated", payload };
		try {
			const tabs = await chrome.tabs.query({});
			for (const tab of tabs) {
				if (tab.id) chrome.tabs.sendMessage(tab.id, broadcast).catch(() => {});
			}
		} catch (error) {
			this.logger.warn("Failed to broadcast Enhancer account state:", error);
		}
	}

	private getIdentityApi(): typeof chrome.identity | undefined {
		const scoped = globalThis as typeof globalThis & { browser?: { identity?: typeof chrome.identity } };
		if (scoped.browser?.identity) return scoped.browser.identity;
		if (typeof chrome !== "undefined") return chrome.identity;
		return undefined;
	}

	private endpoint(name: "auth" | "token" | "revoke"): string {
		return `${EnhancerAccountService.ISSUER}/protocol/openid-connect/${name}`;
	}
}
