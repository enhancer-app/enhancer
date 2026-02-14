import { Logger } from "$shared/logger/logger.ts";
import type { PlatformStatusScraper } from "$shared/worker/shared-followers/scrapers/platform-status.scraper.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { StreamStatusResult } from "$types/shared/worker/shared-storage.types.ts";

/**
 * Placeholder scraper for Twitch stream status.
 *
 * TODO: Implement actual Twitch stream status checking.
 * The Twitch internal Apollo client is only available in content scripts,
 * not in the service worker. Possible approaches:
 * - Use the Twitch Helix API (requires a client-id or OAuth token)
 * - Bridge to the content script which uses Apollo to check, then relay back
 *
 * When implemented, this scraper should support checking up to 30 channels
 * in a single API call (e.g., Helix GET /streams?user_login=a&user_login=b&...).
 */
export class TwitchStatusScraper implements PlatformStatusScraper {
	readonly platform: PlatformType = "twitch";
	readonly maxBatchSize = 30;

	private readonly logger = new Logger({ context: "twitch-status-scraper" });

	async checkStatusBatch(channelIds: string[]): Promise<Map<string, StreamStatusResult>> {
		this.logger.debug(`Twitch status scraper not yet implemented, returning offline for ${channelIds.length} channels`);

		const results = new Map<string, StreamStatusResult>();
		const offlineResult: StreamStatusResult = {
			isLive: false,
			gameName: null,
			viewerCount: 0,
			startedAt: null,
		};

		for (const channelId of channelIds) {
			results.set(channelId, offlineResult);
		}

		return results;
	}
}
