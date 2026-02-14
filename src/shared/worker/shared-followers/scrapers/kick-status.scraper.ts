import { HttpClient } from "$shared/http/http-client.ts";
import { Logger } from "$shared/logger/logger.ts";
import type { PlatformStatusScraper } from "$shared/worker/shared-followers/scrapers/platform-status.scraper.ts";
import type { KickChannelProfile } from "$types/platforms/kick/kick.api.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { StreamStatusResult } from "$types/shared/worker/shared-storage.types.ts";

export class KickStatusScraper implements PlatformStatusScraper {
	readonly platform: PlatformType = "kick";
	readonly maxBatchSize = 10;

	private readonly logger = new Logger({ context: "kick-status-scraper" });
	private readonly http = new HttpClient(this.logger);

	private static readonly BASE_URL = "https://kick.com/api/v1/channels";
	private static readonly REQUEST_TIMEOUT_MS = 10_000;
	private static readonly DELAY_BETWEEN_CALLS_MS = 500;

	async checkStatusBatch(channelIds: string[]): Promise<Map<string, StreamStatusResult>> {
		const results = new Map<string, StreamStatusResult>();

		for (let i = 0; i < channelIds.length; i++) {
			const channelId = channelIds[i];
			const result = await this.checkSingleChannel(channelId);
			results.set(channelId, result);

			// Delay between calls to avoid rate limiting (skip after last call)
			if (i < channelIds.length - 1) {
				await this.delay(KickStatusScraper.DELAY_BETWEEN_CALLS_MS);
			}
		}

		return results;
	}

	private async checkSingleChannel(channelId: string): Promise<StreamStatusResult> {
		try {
			const url = `${KickStatusScraper.BASE_URL}/${encodeURIComponent(channelId)}`;
			const { data } = await this.http.request<KickChannelProfile>(url, {
				method: "GET",
				timeout: KickStatusScraper.REQUEST_TIMEOUT_MS,
			});

			const livestream = data.livestream;

			if (!livestream || !livestream.is_live) {
				return {
					isLive: false,
					gameName: null,
					viewerCount: 0,
					startedAt: null,
				};
			}

			return {
				isLive: true,
				gameName: livestream.categories?.[0]?.name ?? null,
				viewerCount: livestream.viewer_count ?? 0,
				startedAt: livestream.start_time ?? null,
			};
		} catch (error) {
			this.logger.warn(`Failed to check status for Kick channel "${channelId}":`, error);
			return {
				isLive: false,
				gameName: null,
				viewerCount: 0,
				startedAt: null,
			};
		}
	}

	private delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
