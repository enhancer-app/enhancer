import { SidebarChannelHoverComponent } from "$shared/components/cross-platform-follows/sidebar-channel-hover.component.tsx";
import { createSidebarChannel, getLoginFromHref, parseViewerCount } from "$shared/utils/sidebar-channel.utils.ts";
import TwitchModule from "$twitch/twitch.module.ts";
import type { SidebarChannel } from "$types/shared/components/cross-platform-follows.component.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import { render } from "preact";

const ROW_SELECTOR = "#side-nav a.side-nav-card__link, #side-nav a.side-nav-card";
const NATIVE_TOOLTIP = ".online-side-nav-channel-tooltip__body";

export default class SidebarChannelHoverModule extends TwitchModule {
	readonly config: TwitchModuleConfig = {
		name: "sidebar-channel-hover",
		appliers: [
			{
				type: "selector",
				selectors: ["#side-nav"],
				callback: this.mount.bind(this),
				key: "sidebar-channel-hover",
				once: true,
			},
			{
				type: "event",
				event: "extension:settings-refresh",
				callback: this.handleSettingsRefresh.bind(this),
				key: "sidebar-channel-hover-settings",
			},
		],
		enabled: () => this.isEnabled(),
	};

	private container: HTMLElement | null = null;

	initialize(): void {
		this.commonUtils().createGlobalStyle(
			`body:has(#${this.getId()}) .tw-dialog-layer:has(${NATIVE_TOOLTIP}) { display: none !important; }`,
		);
	}

	private mount(): void {
		if (this.container?.isConnected) return;
		this.container = document.createElement("div");
		this.container.id = this.getId();
		document.body.append(this.container);
		render(
			<SidebarChannelHoverComponent
				rowSelector={ROW_SELECTOR}
				readChannel={readTwitchSidebarChannel}
				resolvePreviewUrl={this.resolvePreviewUrl}
			/>,
			this.container,
		);
	}

	private resolvePreviewUrl = async (platform: PlatformType, login: string) =>
		(await this.workerService().send("getStreamPlaybackUrl", { platform, login }))?.url ?? null;

	private unmount(): void {
		if (!this.container) return;
		render(null, this.container);
		this.container.remove();
		this.container = null;
	}

	private handleSettingsRefresh(): void {
		if (!this.isEnabled()) this.unmount();
	}

	private isEnabled(): boolean {
		const settings = this.globalSettings();
		return settings.crossPlatformFollowsSyncEnabled && settings.crossPlatformFollowsDisplayEnabled;
	}
}

function readTwitchSidebarChannel(row: HTMLElement): SidebarChannel | null {
	const login = getLoginFromHref(row.getAttribute("href"));
	if (!login || row.closest("#enhancer-cross-platform-follows")) return null;
	const tooltip = document.querySelector(NATIVE_TOOLTIP);
	const status = row.querySelector('[data-a-target="side-nav-live-status"]');
	if (!row.querySelector(".tw-channel-status-indicator") && !tooltip?.querySelector(".tw-channel-status-indicator")) {
		return null;
	}
	const [tooltipName, tooltipCategory] = tooltip?.querySelector("p[title]")?.getAttribute("title")?.split(" · ") ?? [];
	const text = (element: Element | null | undefined) => element?.textContent?.trim() || null;
	return createSidebarChannel("twitch", {
		login,
		displayName:
			text(row.querySelector('[data-a-target="side-nav-title"]')) ??
			row.querySelector("p[title]")?.getAttribute("title") ??
			tooltipName ??
			login,
		avatarUrl: row.querySelector("img")?.getAttribute("src") ?? null,
		live: true,
		viewers: parseViewerCount(
			text(status?.querySelector("span[aria-hidden]")) ??
				text(tooltip?.querySelector(".online-side-nav-channel-tooltip__text")),
		),
		title: text(tooltip?.querySelector("p:not([title])")),
		category: text(row.querySelector(".side-nav-card__metadata p")) ?? tooltipCategory ?? null,
	});
}
