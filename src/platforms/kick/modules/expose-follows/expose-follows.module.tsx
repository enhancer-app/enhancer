import KickModule from "$kick/kick.module.ts";
import { COMMON_KEYS } from "$types/shared/common/common.types.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";

export default class ExposeFollowsModule extends KickModule {
	config: KickModuleConfig = {
		name: "expose-follows",
		appliers: [
			{
				type: "event",
				event: "extension:start",
				callback: this.run.bind(this),
				key: "expose-follows",
			},
		],
		isModuleEnabledCallback: async () => await this.settingsService().getSettingsKey("exposeFollowedToOthers"),
	};

	private authHeader: string | null = null;
	private isSyncInProgress = false;

	private async run() {
		this.authHeader = `Bearer ${this.commonUtils().getCookie("session_token")}`;
		void this.syncFollowedToCommon();
	}

	private async syncFollowedToCommon() {
		try {
			if (!this.authHeader) {
				this.logger.debug("Skipping expose follows sync: missing Authorization header");
				return;
			}
			if (this.isSyncInProgress) {
				this.logger.debug("Expose follows sync already in progress - skipping new run");
				return;
			}
			this.isSyncInProgress = true;
			const names = await this.fetchAllFollowed();
			if (names.length === 0) return;
			await this.workerService().send("setCommon", {
				platform: "twitch",
				key: COMMON_KEYS.twitch.kickStreamers,
				value: names,
			});
			this.logger.debug("Exposed Kick followed channels to common store", names);
		} catch (error) {
			this.logger.warn("Failed to sync Kick followed channels:", error);
		} finally {
			this.isSyncInProgress = false;
		}
	}

	private async fetchAllFollowed(): Promise<string[]> {
		const collected = new Set<string>();
		let cursor = 0;
		const authorization = this.authHeader;
		if (!authorization) return [];
		while (true) {
			try {
				const url = new URL("https://kick.com/api/v2/channels/followed");
				url.searchParams.set("cursor", String(cursor));
				const res = await fetch(url.href, {
					method: "GET",
					headers: { Authorization: authorization },
					credentials: "include",
				});
				if (!res.ok) break;
				const data = (await res.json()) as {
					nextCursor?: number | null;
					channels?: Array<{ channel_slug?: string | null; user_username?: string | null }>;
				};
				(data.channels ?? []).forEach((c) => {
					const name = (c.channel_slug || c.user_username || "").toString().trim();
					if (name) collected.add(name.toLowerCase());
				});
				if (typeof data.nextCursor !== "number") break;
				cursor = data.nextCursor;
			} catch (e) {
				break;
			}
		}
		return Array.from(collected);
	}
}
