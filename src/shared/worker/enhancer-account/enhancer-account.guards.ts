import { isRecord } from "$shared/worker/moments/moments.guards.ts";
import type { OidcErrorResponse, OidcTokenResponse } from "$types/apis/enhancer-account.apis.ts";
import type { EnhancerAccountSession } from "$types/shared/worker/enhancer-account-worker.types.ts";

export function isOidcTokenResponse(value: unknown): value is OidcTokenResponse {
	return (
		isRecord(value) &&
		typeof value.access_token === "string" &&
		typeof value.expires_in === "number" &&
		typeof value.token_type === "string" &&
		(value.refresh_token === undefined || typeof value.refresh_token === "string") &&
		(value.id_token === undefined || typeof value.id_token === "string") &&
		(value.refresh_expires_in === undefined || typeof value.refresh_expires_in === "number")
	);
}

export function isOidcErrorResponse(value: unknown): value is OidcErrorResponse {
	return isRecord(value) && typeof value.error === "string";
}

export function isEnhancerAccountSession(value: unknown): value is EnhancerAccountSession {
	return (
		isRecord(value) &&
		typeof value.accessToken === "string" &&
		(value.refreshToken === null || typeof value.refreshToken === "string") &&
		(value.idToken === null || typeof value.idToken === "string") &&
		typeof value.expiresAt === "number" &&
		(value.refreshExpiresAt === null || typeof value.refreshExpiresAt === "number") &&
		isRecord(value.profile)
	);
}
