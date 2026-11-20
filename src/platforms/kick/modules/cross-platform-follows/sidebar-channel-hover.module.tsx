import KickModule from "$kick/kick.module.ts";
import { SidebarChannelHoverComponent } from "$shared/components/cross-platform-follows/sidebar-channel-hover.component.tsx";
import { createSidebarChannel, getLoginFromHref, parseViewerCount } from "$shared/utils/sidebar-channel.utils.ts";
import type { SidebarChannel } from "$types/shared/components/cross-platform-follows.component.types.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import { render } from "preact";

const ROW_SELECTOR = '#sidebar-wrapper a[data-testid^="sidebar-recommended-channel"]';
const NATIVE_TOOLTIP = "[data-radix-popper-content-wrapper]";

export default class SidebarChannelHoverModule extends KickModule {
	readonly config: KickModuleConfig = {
		name: "sidebar-channel-hover",
		appliers: [
			{
				type: "selector",
				selectors: ["#sidebar-wrapper"],
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
			`body:has(#${this.getId()}):has(${ROW_SELECTOR}[aria-describedby]) ${NATIVE_TOOLTIP}:has([role="tooltip"]) { display: none !important; }`,
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
				readChannel={readKickSidebarChannel}
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

function readKickSidebarChannel(row: HTMLElement): SidebarChannel | null {
	const login = getLoginFromHref(row.getAttribute("href"));
	if (!login) return null;
	const describedBy = row.getAttribute("aria-describedby");
	const tooltip = describedBy ? document.getElementById(describedBy)?.closest(NATIVE_TOOLTIP) : null;
	const image = row.querySelector("img");
	const labels = row.querySelector("span.truncate") ? row : tooltip;
	const [name, category] = [...(labels?.querySelectorAll("span.truncate") ?? [])].map(
		(span) => span.textContent?.trim() || null,
	);
	const viewers = row.querySelector("span[title]") ?? tooltip?.querySelector("span[title]");
	return createSidebarChannel("kick", {
		login,
		displayName: name ?? image?.getAttribute("alt") ?? login,
		avatarUrl: image?.getAttribute("src") ?? null,
		live: true,
		viewers: parseViewerCount(viewers?.getAttribute("title")),
		title: tooltip?.querySelector("div[title]")?.getAttribute("title") ?? null,
		category: category ?? null,
		thumbnailUrl: null,
	});
}
