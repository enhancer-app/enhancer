import { isBoolean, isNumber, isObject, isString } from "$shared/utils/type-guards.ts";
import type {
	EnhancerAccount,
	EnhancerBadge,
	EnhancerChannelDto,
	EnhancerAggregateResponse,
	EnhancerAggregateTopic,
	EnhancerChannelTopic,
	EnhancerSubscription,
	EnhancerWebSocketMessage,
	EnhancerApiError,
	EnhancerStreamerWatchTimeData,
} from "$types/apis/enhancer.apis.ts";
import type {
	CachedAggregateSeed,
	EnhancerApiSeedRequestPayload,
} from "$types/shared/worker/enhancer-api-worker.types.ts";
import type {
	BridgeBroadcastEnvelope,
	BridgeLogsResponse,
	BridgeRequestId,
} from "$types/shared/worker/bridge-envelope.types.ts";
import type { LogEntry } from "$types/shared/logger.types.ts";
import type { ExtensionResponseDetail } from "$types/shared/worker/worker.types.ts";

export function isAggregateTopic(value: unknown): value is EnhancerAggregateTopic {
	return isString(value) && /^(global:(TWITCH|KICK)|channel:(TWITCH|KICK):.*)$/.test(value);
}

function isChannelTopic(value: unknown): value is EnhancerChannelTopic {
	return isAggregateTopic(value) && value.startsWith("channel:");
}

function isApiPlatform(value: unknown): value is "TWITCH" | "KICK" {
	return value === "TWITCH" || value === "KICK";
}

function isPlatform(value: unknown): value is "twitch" | "kick" {
	return value === "twitch" || value === "kick";
}

function isStrings(value: unknown): value is string[] {
	return Array.isArray(value) && value.every(isString);
}

function isAccount(value: unknown): value is EnhancerAccount {
	return (
		isObject(value) &&
		"accountId" in value &&
		isString(value.accountId) &&
		"externalId" in value &&
		isString(value.externalId) &&
		"badgesIds" in value &&
		isStrings(value.badgesIds) &&
		"customNickname" in value &&
		(value.customNickname === null || isString(value.customNickname)) &&
		"hasGlow" in value &&
		isBoolean(value.hasGlow) &&
		"customFont" in value &&
		(value.customFont === null || isString(value.customFont))
	);
}

function isBadge(value: unknown): value is EnhancerBadge {
	return (
		isObject(value) &&
		"badgeId" in value &&
		isString(value.badgeId) &&
		"name" in value &&
		isString(value.name) &&
		"priority" in value &&
		isNumber(value.priority) &&
		"sources" in value &&
		isObject(value.sources) &&
		Object.values(value.sources).every(isString)
	);
}

export function isChannelAggregate(value: unknown): value is EnhancerChannelDto {
	return (
		isObject(value) &&
		"channelId" in value &&
		(value.channelId === null || isString(value.channelId)) &&
		"platform" in value &&
		isApiPlatform(value.platform) &&
		"accounts" in value &&
		Array.isArray(value.accounts) &&
		value.accounts.every(isAccount) &&
		"badges" in value &&
		Array.isArray(value.badges) &&
		value.badges.every(isBadge)
	);
}

export function isAggregateResponse(value: unknown): value is EnhancerAggregateResponse {
	return isChannelAggregate(value) && "cursor" in value && isString(value.cursor);
}

export function isSeed(value: unknown): value is CachedAggregateSeed {
	return (
		isObject(value) &&
		"topic" in value &&
		isAggregateTopic(value.topic) &&
		"aggregate" in value &&
		isChannelAggregate(value.aggregate) &&
		"cursor" in value &&
		isString(value.cursor)
	);
}

function isSubscription(value: unknown): value is EnhancerSubscription {
	return (
		isObject(value) &&
		"platform" in value &&
		isApiPlatform(value.platform) &&
		"scope" in value &&
		(value.scope === "GLOBAL" ||
			((value.scope === "CHANNEL" || value.scope === "USER") && "externalId" in value && isString(value.externalId)))
	);
}

export function isApiError(value: unknown): value is EnhancerApiError {
	return (
		isObject(value) &&
		"error" in value &&
		isObject(value.error) &&
		"code" in value.error &&
		isString(value.error.code) &&
		"message" in value.error &&
		isString(value.error.message)
	);
}

export function isSocketMessage(value: unknown): value is EnhancerWebSocketMessage {
	if (!isObject(value)) return false;

	if (!("type" in value)) return isApiError(value);

	if (value.type === "connection.ready" || value.type === "pong") return true;

	if (value.type === "error") return "code" in value && isString(value.code);

	if (value.type === "message")
		return (
			"target" in value &&
			isSubscription(value.target) &&
			"name" in value &&
			isString(value.name) &&
			"cursor" in value &&
			isString(value.cursor)
		);

	if (!("topic" in value) || !isAggregateTopic(value.topic)) return false;

	if (
		value.type === "subscription.confirmed" ||
		value.type === "subscription.removed" ||
		value.type === "replay.complete" ||
		value.type === "sync.required"
	)
		return true;

	if (!("cursor" in value) || !isString(value.cursor)) return false;

	if (value.type === "aggregate.snapshot")
		return (
			isChannelAggregate(value) &&
			"snapshotId" in value &&
			isString(value.snapshotId) &&
			"page" in value &&
			isNumber(value.page) &&
			"hasNextPage" in value &&
			isBoolean(value.hasNextPage)
		);

	if (value.type === "aggregate.updated")
		return (
			"accountsUpsert" in value &&
			Array.isArray(value.accountsUpsert) &&
			value.accountsUpsert.every(isAccount) &&
			"badgesUpsert" in value &&
			Array.isArray(value.badgesUpsert) &&
			value.badgesUpsert.every(isBadge) &&
			"accountIdsRemove" in value &&
			isStrings(value.accountIdsRemove) &&
			"badgeIdsRemove" in value &&
			isStrings(value.badgeIdsRemove)
		);

	if (!isChannelTopic(value.topic) || !("reason" in value)) return false;

	if (value.type === "channel.available")
		return value.reason === "created" || value.reason === "restored" || value.reason === "renamed";

	return (
		value.type === "channel.unavailable" &&
		(value.reason === "archived" || value.reason === "renamed") &&
		(!("replacementTopic" in value) || value.replacementTopic === undefined || isChannelTopic(value.replacementTopic))
	);
}

export function isWatchtimeData(value: unknown): value is EnhancerStreamerWatchTimeData[] {
	return Array.isArray(value) && value.every(isWatchtimeEntry);
}

function isWatchtimeEntry(value: unknown): value is EnhancerStreamerWatchTimeData {
	return (
		isObject(value) &&
		"streamerName" in value &&
		isString(value.streamerName) &&
		"minutes" in value &&
		isNumber(value.minutes) &&
		"lastSeen" in value &&
		isString(value.lastSeen) &&
		(!("avatarUrl" in value) || value.avatarUrl === undefined || isString(value.avatarUrl))
	);
}

export function isResponseDetail(value: unknown): value is ExtensionResponseDetail {
	return (
		isObject(value) &&
		"messageId" in value &&
		isString(value.messageId) &&
		(!("error" in value) || value.error === undefined || isString(value.error))
	);
}

export function isRequestId(value: unknown): value is BridgeRequestId {
	return isObject(value) && "requestId" in value && isString(value.requestId);
}

export function isSeedRequest(value: unknown): value is EnhancerApiSeedRequestPayload {
	return isRequestId(value) && "topic" in value && isAggregateTopic(value.topic);
}

function isLogEntry(value: unknown): value is LogEntry {
	return (
		isObject(value) &&
		"timestamp" in value &&
		isNumber(value.timestamp) &&
		"level" in value &&
		(value.level === "debug" || value.level === "info" || value.level === "warn" || value.level === "error") &&
		(!("context" in value) || value.context === undefined || isString(value.context)) &&
		"source" in value &&
		(value.source === "main" || value.source === "bridge" || value.source === "background") &&
		"data" in value &&
		isStrings(value.data)
	);
}

export function isLogsResponse(value: unknown): value is BridgeLogsResponse {
	return (
		isRequestId(value) &&
		(!("logs" in value) || value.logs === undefined || (Array.isArray(value.logs) && value.logs.every(isLogEntry)))
	);
}

export function isBroadcast(value: unknown): value is BridgeBroadcastEnvelope {
	if (!isObject(value) || !("type" in value) || !("payload" in value)) return false;

	const payload = value.payload;

	if (value.type === "enhancer-api-seed-request") return isSeedRequest(payload);

	if (!isObject(payload) || !("platform" in payload) || !isPlatform(payload.platform)) return false;

	if (value.type === "settings-updated") return "settings" in payload && isObject(payload.settings);

	if (
		!("clientId" in payload) ||
		!isString(payload.clientId) ||
		!("topic" in payload) ||
		!isAggregateTopic(payload.topic)
	)
		return false;

	if (value.type === "enhancer-api-message")
		return (
			"message" in payload &&
			isSocketMessage(payload.message) &&
			"type" in payload.message &&
			payload.message.type === "message"
		);

	return (
		value.type === "enhancer-api-updated" &&
		"scope" in payload &&
		(payload.scope === "GLOBAL" || payload.scope === "CHANNEL") &&
		"aggregate" in payload &&
		(payload.aggregate === null || isChannelAggregate(payload.aggregate)) &&
		"cursor" in payload &&
		isString(payload.cursor) &&
		(!("replacementTopic" in payload) ||
			payload.replacementTopic === undefined ||
			isAggregateTopic(payload.replacementTopic))
	);
}
