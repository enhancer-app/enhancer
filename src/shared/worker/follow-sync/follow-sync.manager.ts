import { Logger } from "$shared/logger/logger.ts";
import type { SharedStorageService } from "$shared/worker/shared-storage/shared-storage.service.ts";

export class FollowSyncManager {
	private readonly logger = new Logger({ context: "follow-sync-manager" });
	private static readonly SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
	private syncInterval: ReturnType<typeof setInterval> | null = null;

	constructor(private readonly sharedStorageService: SharedStorageService) {}

	start() {
		if (this.syncInterval) {
			this.logger.warn("Follow sync already running");
			return;
		}

		this.logger.info("Starting follow sync manager");
		this.syncInterval = setInterval(() => this.syncAll(), FollowSyncManager.SYNC_INTERVAL_MS);
	}

	stop() {
		if (this.syncInterval) {
			clearInterval(this.syncInterval);
			this.syncInterval = null;
			this.logger.info("Stopped follow sync manager");
		}
	}

	/**
	 * Periodic sync trigger (actual sync happens in content scripts)
	 * This method serves as a scheduled trigger but doesn't perform actual syncing
	 * because the background script cannot access platform-specific APIs (like cookies, DOM, etc).
	 */
	private async syncAll() {
		try {
			this.logger.debug("Running periodic follow sync (scheduled)");
			// Note: Actual sync happens in the content scripts
			// This manager just ensures periodic triggers
		} catch (error) {
			this.logger.error("Failed to sync follows", error);
		}
	}
}
