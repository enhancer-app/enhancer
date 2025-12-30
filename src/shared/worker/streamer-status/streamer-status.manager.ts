import { Logger } from "$shared/logger/logger.ts";

export class StreamerStatusManager {
	private readonly logger = new Logger({ context: "streamer-status-manager" });
	private static readonly REFRESH_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes - rate limit for status refreshes
	private static readonly MIN_REFRESH_INTERVAL_MS = 30 * 1000; // 30 seconds - minimum time between manual refreshes

	private lastRefreshTime: Record<string, number> = {};
	private refreshInterval: ReturnType<typeof setInterval> | null = null;

	start() {
		if (this.refreshInterval) {
			this.logger.warn("Streamer status refresh already running");
			return;
		}

		this.logger.info("Starting streamer status manager");
		this.refreshInterval = setInterval(() => this.refreshAll(), StreamerStatusManager.REFRESH_INTERVAL_MS);
	}

	stop() {
		if (this.refreshInterval) {
			clearInterval(this.refreshInterval);
			this.refreshInterval = null;
			this.logger.info("Stopped streamer status manager");
		}
	}

	/**
	 * Check if a platform can be refreshed based on rate limiting
	 */
	canRefresh(platform: string): boolean {
		const lastRefresh = this.lastRefreshTime[platform] || 0;
		const now = Date.now();
		return now - lastRefresh >= StreamerStatusManager.MIN_REFRESH_INTERVAL_MS;
	}

	/**
	 * Mark a platform as refreshed
	 */
	markRefreshed(platform: string): void {
		this.lastRefreshTime[platform] = Date.now();
	}

	/**
	 * Periodic refresh trigger (actual refresh happens in content scripts)
	 * This method serves as a scheduled trigger but doesn't perform actual status fetching
	 * because the background script cannot access platform-specific APIs directly.
	 */
	private async refreshAll() {
		try {
			this.logger.debug("Running periodic status refresh (scheduled)");
			// Actual refresh happens in the content scripts via events
			// This just ensures rate limiting is respected
		} catch (error) {
			this.logger.error("Failed to refresh statuses", error);
		}
	}
}
