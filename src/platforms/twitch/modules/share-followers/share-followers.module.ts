import TwitchModule from "$twitch/twitch.module.ts";
import type { ChannelFollowsResponse } from "$types/platforms/twitch/twitch.api.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import type { SharedFollower } from "$types/shared/worker/shared-storage.types.ts";
import gql from "graphql-tag";

export default class ShareFollowersModule extends TwitchModule {
	private readonly SCRAPE_INTERVAL = 600000;
	private scrapingInterval: Timer | undefined;

	private isScraping = false;

	config: TwitchModuleConfig = {
		name: "share-followers",
		appliers: [
			{
				type: "event",
				event: "extension:start",
				callback: this.run.bind(this),
				key: "share-followers-start",
			},
			{
				type: "event",
				event: "twitch:settings:shareFollowersEnabled",
				callback: this.run.bind(this),
				key: "share-followers-change",
			},
		],
		isModuleEnabledCallback: () => this.settingsService().getSettingsKey("shareFollowersEnabled"),
	};

	private async run(): Promise<void> {
		if (this.scrapingInterval) {
			clearInterval(this.scrapingInterval);
		}

		await this.scrapeFollowers();

		this.scrapingInterval = setInterval(() => {
			this.scrapeFollowers();
		}, this.SCRAPE_INTERVAL);
	}

	async scrapeFollowers(): Promise<void> {
		if (!(await this.isModuleEnabled())) {
			return;
		}

		if (this.isScraping) {
			this.logger.debug("Skipping scrape: Follower scrape already in progress.");
			return;
		}

		this.isScraping = true;

		try {
			const followers = await this.scrapeFollowersInternal();
			if (followers.length > 0) {
				await this.saveToSharedStorage(followers);
			}
		} catch (error) {
			this.logger.error("Error during follower scrape", error);
		} finally {
			this.isScraping = false;
		}
	}

	private async scrapeFollowersInternal(): Promise<SharedFollower[]> {
		const collected = new Map<string, SharedFollower>();
		await this.fetchFollowedRecursive(null, collected);
		return Array.from(collected.values());
	}

	private async fetchFollowedRecursive(cursor: string | null, collected: Map<string, SharedFollower>): Promise<void> {
		const client = this.twitchUtils().getApolloClient();

		if (!client) {
			this.logger.warn("Twitch Apollo Client is not available.");
			return;
		}

		try {
			if (cursor) {
				await new Promise((resolve) => setTimeout(resolve, 500));
			}

			const query = gql`
                query ChannelFollows($first: Int, $after: Cursor) {
                    user {
                        id
                        follows(first: $first, after: $after) {
                            edges {
                                cursor
                                node {
                                    id
                                    login
                                    displayName
                                    profileImageURL(width: 70)
                                }
                            }
                            pageInfo {
                                hasNextPage
                            }
                        }
                    }
                }
            `;

			const variables: Record<string, any> = {
				first: 100,
			};

			if (cursor) {
				variables.after = cursor;
			}

			const response = await client.query({
				query: query,
				variables: variables,
				fetchPolicy: "network-only",
			});

			const data = response.data as ChannelFollowsResponse;

			if (!data?.user?.follows?.edges) {
				return;
			}

			const { edges, pageInfo } = data.user.follows;

			edges.forEach((edge) => {
				if (edge.node) {
					collected.set(edge.node.id, {
						platform: "twitch",
						username: edge.node.login,
						channelId: edge.node.id,
						profilePictureUrl: edge.node.profileImageURL ?? undefined,
					});
				}
			});

			if (pageInfo.hasNextPage && edges.length > 0) {
				const lastEdge = edges[edges.length - 1];
				const nextCursor = lastEdge.cursor;

				if (nextCursor && nextCursor !== cursor) {
					await this.fetchFollowedRecursive(nextCursor, collected);
				}
			}
		} catch (error) {
			this.logger.warn(`Failed to fetch followed channels via Apollo at cursor ${cursor}`, error);
			return;
		}
	}

	async saveToSharedStorage(followers: SharedFollower[]): Promise<void> {
		this.logger.debug(`Saving ${followers.length} Twitch followers to shared storage`);
		await this.workerService().send("setSharedStorage", {
			key: "sharedFollowers.twitch",
			value: followers,
		});
	}
}
