import type { Logger } from "$shared/logger/logger.ts";
import type WorkerService from "$shared/worker/worker.service.ts";
import type { FollowsSyncHelperOptions } from "$types/shared/module/follows-sync.helper.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { FollowedChannel } from "$types/shared/worker/cross-platform-follows-worker.types.ts";

const CHECK_INTERVAL_MS = 5 * 60_000;

export class FollowsSyncHelper {
	private enabled: boolean | null = null;
	private interval: number | undefined;
	private running = false;

	constructor(
		private readonly platform: PlatformType,
		private readonly workerService: WorkerService,
		private readonly logger: Logger,
		private readonly options: FollowsSyncHelperOptions,
	) {
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "visible" && this.enabled) void this.tick();
		});
	}

	reportFollow(channel: FollowedChannel, followed: boolean): void {
		if (!this.options.isEnabled()) return;
		void this.workerService
			.send("updateFollow", { platform: this.platform, channel, followed })
			.catch((error) => this.logger.warn("Failed to update followed channel:", error));
	}

	update(): void {
		const enabled = this.options.isEnabled();
		if (enabled === this.enabled) return;
		this.enabled = enabled;
		window.clearInterval(this.interval);
		this.interval = undefined;

		if (!enabled) {
			void this.workerService.send("clearFollows", { platform: this.platform });
			return;
		}

		void this.tick();
		this.interval = window.setInterval(() => void this.tick(), CHECK_INTERVAL_MS);
	}

	private async tick(): Promise<void> {
		if (this.running) return;
		this.running = true;
		try {
			await this.options.beforeSync?.();
			const { collect } = this.options;
			if (!collect || !this.options.isEnabled()) return;

			const snapshot = await this.workerService.send("getFollowsStatus", { platform: this.platform });
			if (snapshot?.synced && snapshot.syncedAt && Date.now() - snapshot.syncedAt < collect.maxAgeMs) return;

			const collection = await collect.run();
			if (!collection || !this.options.isEnabled()) return;

			await this.workerService.send("syncFollows", { platform: this.platform, ...collection });
			this.logger.info(`Shared ${collection.channels.length} followed channels`);
		} catch (error) {
			this.logger.warn("Failed to sync followed channels:", error);
		} finally {
			this.running = false;
		}
	}
}
