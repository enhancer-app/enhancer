import KickModule from "$kick/kick.module.ts";
import { HttpClient } from "$shared/http/http-client.ts";
import type { FollowedChannelsResponse } from "$types/platforms/kick/kick.api.types.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";
import type { SharedFollower } from "$types/shared/worker/shared-storage.types.ts";

export default class ShareFollowersModule extends KickModule {
	private readonly SCRAPE_INTERVAL = 600000;
	private scrapingInterval: Timer | undefined;

	private isScraping = false;

	private readonly http: HttpClient = new HttpClient(this.logger);

	config: KickModuleConfig = {
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
				event: "kick:settings:shareFollowersEnabled",
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
		await this.fetchFollowedRecursive(0, collected);
		return Array.from(collected.values());
	}

	private async fetchFollowedRecursive(cursor: number, collected: Map<string, SharedFollower>): Promise<void> {
		const authorization = this.getAuthHeader();
		if (!authorization) return;

		try {
			if (cursor !== 0) {
				await new Promise((resolve) => setTimeout(resolve, 500));
			}

			const url = new URL("https://kick.com/api/v2/channels/followed");
			url.searchParams.set("cursor", String(cursor));

			const { data } = await this.http.request<FollowedChannelsResponse>(url.href, {
				method: "GET",
				headers: { Authorization: authorization },
			});

			(data.channels ?? []).forEach((channel) => {
				const username = channel.user_username || channel.channel_slug;
				const channelId = channel.channel_slug || channel.user_username;
				if (username && channelId) {
					// Use slug as key for deduplication
					collected.set(String(channelId), {
						platform: "kick",
						username,
						channelId,
						profilePictureUrl: channel.profile_picture ?? undefined,
					});
				}
			});

			if (typeof data.nextCursor === "number" && data.nextCursor !== 0 && data.nextCursor !== cursor) {
				await this.fetchFollowedRecursive(data.nextCursor, collected);
			}
		} catch (error: any) {
			if (error?.response?.status === 401 || error?.response?.status === 403) {
				this.logger.warn("Kick scraping unauthorized, stopping recursion.");
				return;
			}
			this.logger.warn(`Failed to fetch followed channels at cursor ${cursor}`, error);
			return;
		}
	}

	private getAuthHeader(): string | undefined {
		const token = this.commonUtils().getCookie("session_token");
		if (!token) return;
		return `Bearer ${decodeURIComponent(token)}`;
	}

	async saveToSharedStorage(followers: SharedFollower[]): Promise<void> {
		this.logger.debug(`Saving ${followers.length} Kick followers to shared storage`);
		await this.workerService().send("setSharedStorage", {
			key: "sharedFollowers.kick",
			value: followers,
		});
	}
}
