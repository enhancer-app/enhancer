import KickModule from "$kick/kick.module.ts";
import { CrossPlatformFollowsComponent } from "$shared/components/cross-platform-follows/cross-platform-follows.component.tsx";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";
import type {
	FollowsPlatformFilter,
	FollowsSortOrder,
} from "$types/shared/worker/cross-platform-follows-worker.types.ts";
import { render } from "preact";

const HIDDEN_ATTRIBUTE = "data-enhancer-merged-follows";

export default class CrossPlatformFollowsModule extends KickModule {
	readonly config: KickModuleConfig = {
		name: "cross-platform-follows",
		appliers: [
			{
				type: "selector",
				selectors: ["#sidebar-wrapper section"],
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
	private platformFilter: FollowsPlatformFilter | undefined;
	private native: Element[] = [];
	private anchor: Element | null = null;

	initialize(): void {
		this.commonUtils().createGlobalStyle(`[${HIDDEN_ATTRIBUTE}] { display: none !important; }`);
	}

	private mount(sections: Element[]): void {
		const following = sections.find((section) => section.querySelector('[data-testid^="sidebar-following-channel"]'));
		const toggle = following?.nextElementSibling;
		const native = following
			? [following, ...(toggle?.querySelector('[data-testid="sidebar-show-more-following"]') ? [toggle] : [])]
			: [];
		const anchor = following ?? sections[0];
		if (!anchor?.parentElement) return;

		if (native.length !== this.native.length || native.some((element, index) => element !== this.native[index])) {
			this.native.forEach((element) => element.removeAttribute(HIDDEN_ATTRIBUTE));
			this.native = native;
		}
		this.applyNativeVisibility();

		this.anchor = anchor;
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
		const {
			pinnedStreamersEnabled: pinsEnabled,
			followsSort: sort,
			followsPlatformFilter: platformFilter,
		} = this.globalSettings();
		if (
			!this.container ||
			(title === this.title &&
				pinsEnabled === this.pinsEnabled &&
				sort === this.sort &&
				platformFilter === this.platformFilter)
		)
			return;
		this.title = title;
		this.pinsEnabled = pinsEnabled;
		this.sort = sort;
		this.platformFilter = platformFilter;
		render(
			<CrossPlatformFollowsComponent
				hostPlatform="kick"
				workerService={this.workerService()}
				title={title}
				pinsEnabled={pinsEnabled}
				sort={sort}
				onSortChange={(next) => void this.updateGlobalSetting("followsSort", next)}
				platformFilter={platformFilter}
				onPlatformFilterChange={(next) => void this.updateGlobalSetting("followsPlatformFilter", next)}
				onNavigate={(url) => this.kickUtils().navigate(url)}
			/>,
			this.container,
		);
	}

	private place(): void {
		const container = this.container;
		const first = this.native[0];
		if (!container) return;
		if (!first) {
			if (container.nextElementSibling !== this.anchor) this.anchor?.before(container);
		} else if (container.nextElementSibling !== first) {
			first.before(container);
		}
	}

	private readTitle(): string | null {
		return this.native[0]?.firstElementChild?.textContent?.trim() || null;
	}

	private applyNativeVisibility(): void {
		const hidden = !!this.container;
		this.native.forEach((element) => element.toggleAttribute(HIDDEN_ATTRIBUTE, hidden));
	}

	private unmount(): void {
		this.native.forEach((element) => element.removeAttribute(HIDDEN_ATTRIBUTE));
		this.native = [];
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
