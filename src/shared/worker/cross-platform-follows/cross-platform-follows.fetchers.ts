import type { CredentialVault } from "$shared/worker/credentials/credential.vault.ts";
import type {
	FollowedChannelsResponse,
	FollowedLivestreamResponse,
	KickCurrentUserResponse,
} from "$types/platforms/kick/kick.api.types.ts";
import type { GQLResponse, UsersStatusResponse } from "$types/platforms/twitch/twitch.api.types.ts";
import type {
	ChannelStatusFetchResult,
	ChannelStatusUpdate,
	CrossPlatformFollowsProblem,
	FollowedChannel,
} from "$types/shared/worker/cross-platform-follows-worker.types.ts";

const KICK_FOLLOWS_PAGE_DELAY_MS = 250;
const KICK_FOLLOWS_MAX_PAGES = 500;
const TWITCH_GQL_ENDPOINT = "https://gql.twitch.tv/gql";
const TWITCH_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
const TWITCH_LOGINS_PER_REQUEST = 100;
const TWITCH_REQUEST_TIMEOUT_MS = 15_000;

const TWITCH_USERS_STATUS_QUERY = `query EnhancerUsersStatus($logins: [String!]) {
	users(logins: $logins) {
		login
		displayName
		profileImageURL(width: 70)
		stream { viewersCount title createdAt previewImageURL(width: 440, height: 248) game { displayName } }
		lastBroadcast { startedAt }
	}
}`;

function parseTime(value: string | null | undefined): number | null {
	if (!value) return null;
	const normalized = /[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value.replace(" ", "T")}Z`;
	const time = Date.parse(normalized);
	return Number.isNaN(time) ? null : time;
}

type KickJsonResult<T> = { ok: true; body: T } | { ok: false; problem: CrossPlatformFollowsProblem };

async function fetchKickJson<T>(vault: CredentialVault, url: string): Promise<KickJsonResult<T>> {
	const result = await vault.fetch("kick:follows", url);
	if (!result.ok) return { ok: false, problem: result.reason === "failed" ? "request-failed" : "session-missing" };
	if (!result.response.ok) return { ok: false, problem: "request-failed" };
	try {
		return { ok: true, body: (await result.response.json()) as T };
	} catch {
		return { ok: false, problem: "request-failed" };
	}
}

export async function fetchKickAccountId(vault: CredentialVault): Promise<string | null> {
	const result = await fetchKickJson<KickCurrentUserResponse>(vault, "https://kick.com/api/v1/user");
	return result.ok && result.body?.id != null ? String(result.body.id) : null;
}

export async function fetchKickFollows(
	vault: CredentialVault,
): Promise<{ ok: true; channels: FollowedChannel[] } | { ok: false; problem: CrossPlatformFollowsProblem }> {
	const channels = new Map<string, FollowedChannel>();
	let cursor: number | null = 0;
	for (let page = 0; cursor !== null && page < KICK_FOLLOWS_MAX_PAGES; page++) {
		if (page > 0) await new Promise((resolve) => setTimeout(resolve, KICK_FOLLOWS_PAGE_DELAY_MS));

		const result: KickJsonResult<FollowedChannelsResponse> = await fetchKickJson(
			vault,
			`https://kick.com/api/v2/channels/followed?cursor=${cursor}`,
		);
		if (!result.ok) return result;
		if (!Array.isArray(result.body?.channels)) return { ok: false, problem: "request-failed" };

		for (const channel of result.body.channels) {
			const login = channel.channel_slug?.toLowerCase();
			if (!login || channels.has(login)) continue;
			channels.set(login, {
				login,
				displayName: channel.user_username || channel.channel_slug,
				avatarUrl: channel.profile_picture ?? null,
			});
		}
		cursor =
			result.body.channels.length > 0 && typeof result.body.nextCursor === "number" ? result.body.nextCursor : null;
	}

	return cursor === null ? { ok: true, channels: [...channels.values()] } : { ok: false, problem: "request-failed" };
}

export async function fetchKickStatuses(
	vault: CredentialVault,
	channels: FollowedChannel[],
): Promise<ChannelStatusFetchResult> {
	const result = await fetchKickJson<FollowedLivestreamResponse[]>(vault, "https://kick.com/api/v1/user/livestreams");
	if (!result.ok) return result;
	const livestreams = result.body;
	if (!Array.isArray(livestreams)) return { ok: false, problem: "request-failed" };

	const live = new Map<string, FollowedLivestreamResponse>();
	for (const livestream of livestreams) {
		const slug = livestream.channel?.slug?.toLowerCase();
		if (slug) live.set(slug, livestream);
	}

	const statuses: ChannelStatusUpdate[] = channels.map((channel) => {
		const livestream = live.get(channel.login);
		live.delete(channel.login);
		return livestream ? kickLiveStatus(livestream) : offlineStatus(channel);
	});
	for (const livestream of live.values()) statuses.push(kickLiveStatus(livestream));

	return { ok: true, statuses, partial: false };
}

function kickLiveStatus(livestream: FollowedLivestreamResponse): ChannelStatusUpdate {
	return {
		login: livestream.channel.slug.toLowerCase(),
		displayName: livestream.channel.user?.username ?? livestream.channel.slug,
		avatarUrl: livestream.channel.user?.profilepic ?? null,
		live: true,
		viewers: livestream.viewer_count ?? 0,
		title: livestream.session_title ?? null,
		category: livestream.categories?.[0]?.name ?? null,
		thumbnailUrl: livestream.thumbnail?.src ?? null,
		startedAt: parseTime(livestream.start_time),
	};
}

function offlineStatus(channel: FollowedChannel): ChannelStatusUpdate {
	return {
		login: channel.login,
		displayName: channel.displayName,
		avatarUrl: channel.avatarUrl,
		live: false,
		viewers: 0,
		title: null,
		category: null,
		thumbnailUrl: null,
		startedAt: null,
	};
}

export async function fetchTwitchStatuses(channels: FollowedChannel[]): Promise<ChannelStatusFetchResult> {
	const statuses: ChannelStatusUpdate[] = [];
	let failedChunks = 0;
	let chunks = 0;

	for (let index = 0; index < channels.length; index += TWITCH_LOGINS_PER_REQUEST) {
		chunks++;
		const logins = channels.slice(index, index + TWITCH_LOGINS_PER_REQUEST).map((channel) => channel.login);
		try {
			const response = await fetch(TWITCH_GQL_ENDPOINT, {
				method: "POST",
				headers: { "Client-ID": TWITCH_CLIENT_ID, "Content-Type": "application/json" },
				body: JSON.stringify({ query: TWITCH_USERS_STATUS_QUERY, variables: { logins } }),
				signal: AbortSignal.timeout(TWITCH_REQUEST_TIMEOUT_MS),
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const body = (await response.json()) as GQLResponse<UsersStatusResponse>;
			if (!Array.isArray(body.data?.users)) throw new Error("Invalid response");

			for (const user of body.data.users) {
				if (!user) continue;
				statuses.push({
					login: user.login.toLowerCase(),
					displayName: user.displayName,
					avatarUrl: user.profileImageURL,
					live: !!user.stream,
					viewers: user.stream?.viewersCount ?? 0,
					title: user.stream?.title ?? null,
					category: user.stream?.game?.displayName ?? null,
					thumbnailUrl: user.stream?.previewImageURL ?? null,
					startedAt: parseTime(user.stream?.createdAt),
					lastLiveAt: user.stream ? null : parseTime(user.lastBroadcast?.startedAt),
				});
			}
		} catch {
			failedChunks++;
		}
	}

	if (chunks > 0 && failedChunks === chunks) return { ok: false, problem: "request-failed" };
	return { ok: true, statuses, partial: failedChunks > 0 };
}
