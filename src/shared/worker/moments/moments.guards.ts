import type { EnhancerApiError } from "$types/apis/enhancer.apis.ts";
import type {
	ChannelMomentResponse,
	ClaimMomentResponse,
	ClaimStatus,
	ClaimStatusResponse,
	MomentClaimsMessageData,
	PublicMoment,
	ViewerMomentState,
} from "$types/apis/moments.apis.ts";

const CLAIM_STATUSES: ReadonlySet<string> = new Set<ClaimStatus>([
	"GRANTED",
	"ALREADY_CLAIMED",
	"NOT_LIVE",
	"INVALID_CODE",
	"LIMIT_REACHED",
	"BLOCKED",
	"ERROR",
	"NONE",
]);

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
	return typeof value === "string";
}

function isNullableString(value: unknown): value is string | null {
	return value === null || typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
	return isRecord(value) && Object.values(value).every(isString);
}

function isDateString(value: unknown): value is string {
	return isString(value) && !Number.isNaN(Date.parse(value));
}

export function isPublicMoment(value: unknown): value is PublicMoment {
	if (!isRecord(value)) return false;
	const { channel, badge } = value;
	return (
		isString(value.id) &&
		isRecord(channel) &&
		(channel.platform === "TWITCH" || channel.platform === "KICK") &&
		isString(channel.externalChannelId) &&
		isString(channel.login) &&
		isString(channel.displayName) &&
		isNullableString(channel.avatarUrl) &&
		isString(value.title) &&
		isString(value.code) &&
		isString(value.redeemCommand) &&
		(value.status === "LIVE" || value.status === "ENDED") &&
		isDateString(value.startedAt) &&
		isDateString(value.endsAt) &&
		isFiniteNumber(value.claimCount) &&
		(value.maxClaims === null || isFiniteNumber(value.maxClaims)) &&
		isFiniteNumber(value.graceSeconds) &&
		isRecord(badge) &&
		isString(badge.id) &&
		isString(badge.name) &&
		isStringRecord(badge.sources)
	);
}

export function isChannelMomentResponse(value: unknown): value is ChannelMomentResponse {
	return isRecord(value) && (value.moment === null || isPublicMoment(value.moment));
}

export function isClaimStatusResponse(value: unknown): value is ClaimStatusResponse {
	return (
		isRecord(value) &&
		isString(value.status) &&
		CLAIM_STATUSES.has(value.status) &&
		isNullableString(value.claimedAt) &&
		isNullableString(value.attemptAt)
	);
}

export function isViewerMomentState(value: unknown): value is ViewerMomentState {
	if (!isRecord(value)) return false;
	const { claim } = value;
	return (
		typeof value.eligible === "boolean" &&
		isNullableString(value.accountLogin) &&
		(claim === null || (isRecord(claim) && isDateString(claim.claimedAt) && isString(claim.method)))
	);
}

export function isClaimMomentResponse(value: unknown): value is ClaimMomentResponse {
	if (!isRecord(value)) return false;
	const { moment, badge } = value;
	return (
		(value.result === "GRANTED" || value.result === "ALREADY_CLAIMED") &&
		isDateString(value.claimedAt) &&
		(value.accountLogin === undefined || isNullableString(value.accountLogin)) &&
		isRecord(moment) &&
		isString(moment.id) &&
		isRecord(badge) &&
		isString(badge.id) &&
		isString(badge.name) &&
		isStringRecord(badge.sources)
	);
}

export function isEnhancerApiError(value: unknown): value is EnhancerApiError {
	return isRecord(value) && isRecord(value.error) && isString(value.error.code) && isString(value.error.message);
}

export function isMomentClaimsMessageData(value: unknown): value is MomentClaimsMessageData {
	return (
		isRecord(value) &&
		isString(value.momentId) &&
		isFiniteNumber(value.claimCount) &&
		value.claimCount >= 0 &&
		(value.maxClaims === null || isFiniteNumber(value.maxClaims))
	);
}
