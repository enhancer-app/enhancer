import { HttpClient } from "$shared/http/http-client.ts";
import FollowSyncer from "$shared/module/cross-platform-follows/follow-syncer.ts";
import type SharedDataCache from "$shared/shared-data/shared-data.cache.ts";
import type CommonUtils from "$shared/utils/common.utils.ts";
import type { FollowedChannelsResponse } from "$types/platforms/kick/kick.api.types.ts";

export default class KickFollowSyncer extends FollowSyncer {
	private readonly http: HttpClient = new HttpClient(this.logger);
	private static readonly SYNC_COOLDOWN_MS = 2.5 * 60 * 1000;
	private syncInProgress = false;

	constructor(
		private readonly sharedDataCache: SharedDataCache,
		private readonly commonUtils: CommonUtils,
	) {
		super("kick");
	}

	async getFollows() {
		if (this.syncInProgress) {
			this.logger.warn("Sync already in progress, skipping new request");
			return;
		}
		if (this.sharedDataCache.wasRecentlySynced("kick", KickFollowSyncer.SYNC_COOLDOWN_MS)) {
			this.logger.debug("Skipping sync, recently synced by another tab");
			return;
		}
		this.syncInProgress = true;
		try {
			const followed = await this.fetchAllFollowed();
			await this.sharedDataCache.updateFollows("kick", followed);
			this.logger.info(`Synced ${followed.length} followed channels`);
		} catch (err) {
			this.logger.error("Failed to sync follows", err);
		} finally {
			this.syncInProgress = false;
		}
	}

	async clearFollows() {
		await this.sharedDataCache.clearFollows("kick");
	}

	private async fetchAllFollowed(): Promise<string[]> {
		const collected = new Set<string>();
		await this.fetchFollowedRecursive(0, collected);
		return Array.from(collected);
	}

	private async fetchFollowedRecursive(cursor: number, collected: Set<string>) {
		const authorization = this.getAuthHeader();
		if (!authorization) return;

		try {
			const url = new URL("https://kick.com/api/v2/channels/followed");
			url.searchParams.set("cursor", String(cursor));

			const { data } = await this.http.request<FollowedChannelsResponse>(url.href, {
				method: "GET",
				headers: { Authorization: authorization },
			});

			(data.channels ?? []).forEach((channel) => {
				const name = (channel.channel_slug || channel.user_username || "").toString().trim();
				if (name) {
					collected.add(name.toLowerCase());
				}
			});

			if (typeof data.nextCursor === "number") {
				await this.fetchFollowedRecursive(data.nextCursor, collected);
			}
		} catch (error) {
			this.logger.warn(`Failed to fetch followed channels at cursor ${cursor}`, error);
			return;
		}
	}

	private getAuthHeader(): string | undefined {
		const token = this.commonUtils.getCookie("session_token");
		if (!token) return;
		return `Bearer ${token}`;
	}
}
