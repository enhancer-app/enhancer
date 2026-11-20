import KickModule from "$kick/kick.module.ts";
import { FollowsSyncHelper } from "$shared/module/helpers/follows-sync.helper.ts";
import { observeFetch } from "$shared/utils/fetch-observer.utils.ts";
import type { FollowChannelResponse } from "$types/platforms/kick/kick.api.types.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";

const FOLLOW_PATH = /^\/api\/v2\/channels\/([^/]+)\/follow$/;

export default class CrossPlatformFollowsSyncModule extends KickModule {
	readonly config: KickModuleConfig = {
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

	initialize(): void {
		this.helper = new FollowsSyncHelper("kick", this.workerService(), this.logger, {
			isEnabled: () => this.globalSettings().crossPlatformFollowsSyncEnabled,
			beforeSync: () => this.sendSessionToken(),
		});
		observeFetch({
			matches: ({ url, method }) =>
				url.hostname === location.hostname && FOLLOW_PATH.test(url.pathname) && ["POST", "DELETE"].includes(method),
			onResponse: (response, request) => this.handleFollowResponse(response, request.url, request.method),
		});
	}

	private async handleFollowResponse(response: Response, url: URL, method: string): Promise<void> {
		const slug = url.pathname.match(FOLLOW_PATH)?.[1];
		if (!response.ok || !slug) return;
		if (method === "DELETE") {
			this.helper.reportFollow({ login: slug, displayName: slug, avatarUrl: null }, false);
			return;
		}
		const body = (await response.json().catch(() => null)) as FollowChannelResponse | null;
		const channel = body?.channel;
		this.helper.reportFollow(
			{
				login: channel?.slug ?? slug,
				displayName: channel?.user?.username ?? slug,
				avatarUrl: channel?.user?.profile_pic ?? null,
			},
			true,
		);
	}

	private getSessionToken(): string | null {
		const match = document.cookie.match(/(?:^|;\s*)session_token=([^;]*)/);
		if (!match?.[1]) return null;
		try {
			return decodeURIComponent(match[1]);
		} catch {
			return null;
		}
	}

	private async sendSessionToken(): Promise<void> {
		await this.workerService().send("syncKickSession", { token: this.getSessionToken() });
	}
}
