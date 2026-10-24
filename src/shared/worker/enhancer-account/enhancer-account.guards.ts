import type { EnhancerApiError } from "$types/apis/enhancer.apis.ts";
import type {
	EnhancerChatAccountStyle,
	EnhancerViewerBadge,
	EnhancerViewerBadges,
	EnhancerViewerBilling,
	EnhancerViewerIdentity,
	EnhancerViewerSummary,
	OidcErrorResponse,
	OidcTokenResponse,
} from "$types/apis/enhancer-account.apis.ts";
import type { EnhancerAccountSession } from "$types/shared/worker/enhancer-account-worker.types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isEnhancerApiError(value: unknown): value is EnhancerApiError {
	return (
		isRecord(value) &&
		isRecord(value.error) &&
		typeof value.error.code === "string" &&
		typeof value.error.message === "string"
	);
}

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

function isNullableString(value: unknown): value is string | null {
	return value === null || typeof value === "string";
}

function isViewerIdentity(value: unknown): value is EnhancerViewerIdentity {
	return (
		isRecord(value) &&
		typeof value.provider === "string" &&
		isNullableString(value.providerUsername) &&
		isNullableString(value.providerDisplayName) &&
		isNullableString(value.avatarUrl)
	);
}

export function isViewerSummary(value: unknown): value is EnhancerViewerSummary {
	if (!isRecord(value) || !isRecord(value.user) || !Array.isArray(value.identities)) return false;
	const { user } = value;
	return (
		typeof user.id === "string" &&
		isNullableString(user.username) &&
		isNullableString(user.displayName) &&
		isNullableString(user.primaryProvider) &&
		isNullableString(user.avatarUrl) &&
		typeof user.createdAt === "string" &&
		value.identities.every(isViewerIdentity)
	);
}

function isViewerBadge(value: unknown): value is EnhancerViewerBadge {
	return (
		isRecord(value) &&
		typeof value.assignmentId === "string" &&
		typeof value.accountId === "string" &&
		(value.accountPlatform === "TWITCH" || value.accountPlatform === "KICK") &&
		typeof value.accountLogin === "string" &&
		typeof value.badgeId === "string" &&
		typeof value.name === "string" &&
		isRecord(value.sources) &&
		Object.values(value.sources).every((source) => typeof source === "string") &&
		(value.scope === "GLOBAL" || value.scope === "CHANNEL") &&
		isNullableString(value.channelId) &&
		isNullableString(value.channelLogin) &&
		(value.channelDisplayName === undefined || isNullableString(value.channelDisplayName)) &&
		isNullableString(value.channelAvatarUrl) &&
		typeof value.hidden === "boolean" &&
		typeof value.forced === "boolean" &&
		typeof value.visible === "boolean" &&
		typeof value.createdAt === "string" &&
		isNullableString(value.cooldownUntil)
	);
}

export function isViewerBadges(value: unknown): value is EnhancerViewerBadges {
	return (
		isRecord(value) &&
		Array.isArray(value.global) &&
		Array.isArray(value.channels) &&
		value.global.every(isViewerBadge) &&
		value.channels.every(isViewerBadge)
	);
}

function isChatAccountStyle(value: unknown): value is EnhancerChatAccountStyle {
	return (
		isRecord(value) &&
		typeof value.accountId === "string" &&
		(value.platform === "TWITCH" || value.platform === "KICK") &&
		typeof value.login === "string" &&
		typeof value.displayName === "string" &&
		typeof value.hasGlow === "boolean" &&
		isNullableString(value.customFont) &&
		isNullableString(value.styleCooldownUntil) &&
		isNullableString(value.nickname) &&
		isNullableString(value.nicknameCooldownUntil) &&
		isNullableString(value.nicknamePending) &&
		(value.nicknameRejected === null ||
			(isRecord(value.nicknameRejected) &&
				typeof value.nicknameRejected.nickname === "string" &&
				isNullableString(value.nicknameRejected.reason)))
	);
}

export function isViewerBilling(value: unknown): value is EnhancerViewerBilling {
	if (!isRecord(value) || !isRecord(value.style) || !Array.isArray(value.accounts)) return false;
	const { style } = value;
	return (
		typeof value.enabled === "boolean" &&
		typeof style.glowAllowed === "boolean" &&
		typeof style.fontAllowed === "boolean" &&
		typeof style.nicknameAllowed === "boolean" &&
		typeof style.nicknameCooldownDays === "number" &&
		Array.isArray(style.fonts) &&
		style.fonts.every((font) => typeof font === "string") &&
		value.accounts.every(isChatAccountStyle)
	);
}
