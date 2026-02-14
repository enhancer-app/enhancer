import KickModule from "$kick/kick.module.ts";
import LiveStreamersComponent from "$shared/components/live-streamers/live-streamers.component.tsx";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";
import { render } from "preact";

export default class DisplaySharedFollowersModule extends KickModule {
	private FLEX_ORDER = 3;

	config: KickModuleConfig = {
		name: "display-shared-followers",
		appliers: [
			{
				type: "selector",
				selectors: ["#sidebar-wrapper .no-scrollbar"],
				callback: this.run.bind(this),
				key: "live-streamers-display",
				once: true,
			},
		],
		isModuleEnabledCallback: () => this.settingsService().getSettingsKey("displaySharedFollowersEnabled"),
	};

	private run(elements: Element[]): void {
		const element = elements[0]?.children[0];
		if (!element) return;

		const existing = document.getElementById(this.getId());
		if (existing) return;

		this.reorderChildren(element);

		const wrapper = this.commonUtils().createElementByParent(this.getId(), "div", element);
		wrapper.style.order = `${this.FLEX_ORDER}`;
		render(<LiveStreamersComponent currentPlatform="kick" workerService={this.workerService()} />, wrapper);
	}

	private reorderChildren(parent: Element): void {
		const children = Array.from(parent.children) as HTMLElement[];
		let currentOrder = 1;

		children.forEach((child) => {
			if (child.id === this.getId()) return;

			if (currentOrder === this.FLEX_ORDER) {
				currentOrder++;
			}

			child.style.order = `${currentOrder}`;
			currentOrder++;
		});
	}
}
