import { FollowsSyncHelper } from "$shared/module/helpers/follows-sync.helper.ts";
import { observeFetch } from "$shared/utils/fetch-observer.utils.ts";
import { CurrentUserFollowsQuery } from "$twitch/apis/twitch-queries.ts";
import TwitchModule from "$twitch/twitch.module.ts";
import type { CurrentUserFollowsResponse, FollowMutationResult } from "$types/platforms/twitch/twitch.api.types.ts";
import type { FollowsSyncCollection } from "$types/shared/module/follows-sync.helper.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import type { FollowedChannel } from "$types/shared/worker/cross-platform-follows-worker.types.ts";
import gql from "graphql-tag";

const PAGE_SIZE = 100;
const MAX_PAGES = 100;
const FOLLOWS_MAX_AGE_MS = 10 * 60_000;

export default class CrossPlatformFollowsSyncModule extends TwitchModule {
	readonly config: TwitchModuleConfig = {
		name: "cross-platform-follows-sync",
		appliers: [
			{
				type: "event",
				event: "extension:start",
				callback: () => this.helper.update(),
				key: "cross-platform-follows-sync-start",
			},
			{
				type: "event",
				event: "extension:settings-refresh",
				callback: () => this.helper.update(),
				key: "cross-platform-follows-sync-refresh",
			},
		],
	};

	private helper!: FollowsSyncHelper;
	private readonly query = gql(CurrentUserFollowsQuery);

	initialize(): void {
		this.helper = new FollowsSyncHelper("twitch", this.workerService(), this.logger, {
			isEnabled: () => this.globalSettings().crossPlatformFollowsSyncEnabled,
			collect: { maxAgeMs: FOLLOWS_MAX_AGE_MS, run: () => this.collectFollows() },
		});
		observeFetch({
			matches: ({ url, method, body }) =>
				url.hostname === "gql.twitch.tv" && method === "POST" && typeof body === "string" && /followuser/i.test(body),
			onResponse: (response) => this.handleGqlResponse(response),
		});
	}

	private async handleGqlResponse(response: Response): Promise<void> {
		if (!response.ok) return;
		const body = (await response.json().catch(() => null)) as FollowMutationResult | FollowMutationResult[] | null;
		for (const result of Array.isArray(body) ? body : [body]) {
			const followed = result?.data?.followUser;
			const unfollowed = result?.data?.unfollowUser;
			const user = (followed ?? unfollowed)?.follow?.user;
			if (!user?.login || followed?.error) continue;
			this.helper.reportFollow(
				{ login: user.login, displayName: user.displayName || user.login, avatarUrl: null },
				!!followed,
			);
		}
	}

	private async collectFollows(): Promise<FollowsSyncCollection | null> {
		const client = this.twitchUtils().getApolloClient();
		if (!client) {
			this.logger.warn("Apollo client not found, skipping follows sync");
			return null;
		}

		const channels: FollowedChannel[] = [];
		let cursor: string | null = null;
		for (let page = 0; page < MAX_PAGES; page++) {
			const response = (await client.query({
				query: this.query,
				variables: { first: PAGE_SIZE, after: cursor },
				fetchPolicy: "network-only",
			})) as { data?: CurrentUserFollowsResponse };

			const follows = response.data?.currentUser?.follows;
			if (!follows) return null;

			for (const edge of follows.edges) {
				if (!edge.node?.login) continue;
				channels.push({
					login: edge.node.login,
					displayName: edge.node.displayName || edge.node.login,
					avatarUrl: edge.node.profileImageURL ?? null,
				});
			}

			const last = follows.edges.at(-1);
			if (!follows.pageInfo.hasNextPage || !last?.cursor) return { channels };
			cursor = last.cursor;
		}

		return null;
	}
}
