import { CrossPlatformFollowsComponent } from "$shared/components/cross-platform-follows/cross-platform-follows.component.tsx";
import TwitchModule from "$twitch/twitch.module.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import type { FollowsSortOrder } from "$types/shared/worker/cross-platform-follows-worker.types.ts";
import { render } from "preact";

const HIDDEN_ATTRIBUTE = "data-enhancer-merged-follows";

export default class CrossPlatformFollowsModule extends TwitchModule {
	readonly config: TwitchModuleConfig = {
		name: "cross-platform-follows",
		appliers: [
			{
				type: "selector",
				selectors: ["#side-nav .side-nav-section"],
				callback: this.mount.bind(this),
				key: "cross-platform-follows",
			},
			{
				type: "event",
				event: "extension:settings-refresh",
				callback: this.handleSettingsRefresh.bind(this),
				key: "cross-platform-follows-settings",
			},
		],
		enabled: () => this.isEnabled(),
	};

	private container: HTMLElement | null = null;
	private title: string | null | undefined;
	private pinsEnabled: boolean | undefined;
	private sort: FollowsSortOrder | undefined;
	private native: Element | null = null;
	private anchor: Element | null = null;

	initialize(): void {
		this.commonUtils().createGlobalStyle(`#side-nav [${HIDDEN_ATTRIBUTE}] { display: none !important; }`);
	}

	private mount(sections: Element[]): void {
		const native =
			sections.find((section) =>
				section.querySelector('[data-test-selector="followed-channel"], .followed-side-nav-header'),
			) ?? null;
		const anchor = native ?? sections[0];
		if (!anchor?.parentElement) return;

		if (native !== this.native) {
			this.native?.removeAttribute(HIDDEN_ATTRIBUTE);
			this.native = native;
		}
		this.anchor = anchor;
		this.applyNativeVisibility();

		if (this.container?.isConnected && this.container.parentElement === anchor.parentElement) {
			this.place();
			this.renderComponent();
			return;
		}
		this.unmount();

		this.native = native;
		this.anchor = anchor;
		this.container = document.createElement("div");
		this.container.id = this.getId();
		this.place();
		this.title = undefined;
		this.renderComponent();
	}

	private renderComponent(): void {
		const title = this.readTitle();
		const { pinnedStreamersEnabled: pinsEnabled, followsSort: sort } = this.globalSettings();
		if (!this.container || (title === this.title && pinsEnabled === this.pinsEnabled && sort === this.sort)) return;
		this.title = title;
		this.pinsEnabled = pinsEnabled;
		this.sort = sort;
		render(
			<CrossPlatformFollowsComponent
				hostPlatform="twitch"
				workerService={this.workerService()}
				title={title}
				pinsEnabled={pinsEnabled}
				sort={sort}
				onSortChange={(next) => void this.updateGlobalSetting("followsSort", next)}
				onNavigate={(url) => this.twitchUtils().navigate(url)}
			/>,
			this.container,
		);
	}

	private place(): void {
		const container = this.container;
		if (!container) return;
		if (!this.native) {
			if (container.previousElementSibling !== this.anchor) this.anchor?.after(container);
		} else if (container.nextElementSibling !== this.native) {
			this.native.before(container);
		}
	}

	private readTitle(): string | null {
		const text = this.native?.querySelector(".followed-side-nav-header h3, .followed-side-nav-header h2")?.textContent;
		return text?.trim().replace(/:$/, "") || null;
	}

	private applyNativeVisibility(): void {
		this.native?.toggleAttribute(HIDDEN_ATTRIBUTE, !!this.container);
	}

	private unmount(): void {
		this.native?.removeAttribute(HIDDEN_ATTRIBUTE);
		this.native = null;
		if (!this.container) return;
		render(null, this.container);
		this.container.remove();
		this.container = null;
	}

	private handleSettingsRefresh(): void {
		if (!this.isEnabled()) this.unmount();
		else this.renderComponent();
	}

	private isEnabled(): boolean {
		const settings = this.globalSettings();
		return settings.crossPlatformFollowsSyncEnabled && settings.crossPlatformFollowsDisplayEnabled;
	}
}
