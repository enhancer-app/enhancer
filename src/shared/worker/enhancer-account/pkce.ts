import type { OidcIdTokenClaims } from "$types/apis/enhancer-account.apis.ts";
import type { AuthorizationCallback, PkceChallenge } from "$types/shared/worker/enhancer-account-worker.types.ts";

export function base64UrlEncode(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(value: string): string {
	const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
	const binary = atob(padded);
	const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
	return new TextDecoder().decode(bytes);
}

export function createRandomString(byteLength = 32): string {
	return base64UrlEncode(crypto.getRandomValues(new Uint8Array(byteLength)));
}

export async function createCodeChallenge(verifier: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
	return base64UrlEncode(new Uint8Array(digest));
}

export async function createPkceChallenge(): Promise<PkceChallenge> {
	const verifier = createRandomString(32);
	return { verifier, challenge: await createCodeChallenge(verifier), method: "S256" };
}

export function parseAuthorizationCallback(callbackUrl: string, expectedState: string): AuthorizationCallback {
	let url: URL;
	try {
		url = new URL(callbackUrl);
	} catch {
		return { error: "Invalid authorization response", cancelled: false };
	}
	const params = url.searchParams.has("state") ? url.searchParams : new URLSearchParams(url.hash.slice(1));
	const error = params.get("error");
	if (error) return { error: params.get("error_description") ?? error, cancelled: error === "access_denied" };
	if (params.get("state") !== expectedState) return { error: "Authorization state mismatch", cancelled: false };
	const code = params.get("code");
	if (!code) return { error: "Authorization code is missing", cancelled: false };
	return { code };
}

export function decodeJwtClaims(token: string): OidcIdTokenClaims | null {
	const [, payload] = token.split(".");
	if (!payload) return null;
	try {
		const claims: unknown = JSON.parse(base64UrlDecode(payload));
		return typeof claims === "object" && claims !== null && !Array.isArray(claims)
			? (claims as OidcIdTokenClaims)
			: null;
	} catch {
		return null;
	}
}
