import LiveStreamersComponent from "$shared/components/live-streamers/live-streamers.component.tsx";
import TwitchModule from "$twitch/twitch.module.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import { render } from "preact";

export default class DisplaySharedFollowersModule extends TwitchModule {
	config: TwitchModuleConfig = {
		name: "display-shared-followers",
		appliers: [
			{
				type: "selector",
				selectors: [".side-nav-section"],
				callback: this.run.bind(this),
				key: "live-streamers-display",
				once: true,
				useParent: true,
			},
		],
		isModuleEnabledCallback: () => this.settingsService().getSettingsKey("displaySharedFollowersEnabled"),
	};

	private run(elements: Element[]): void {
		const element = elements[0];
		if (!element) return;

		const existing = document.getElementById(this.getId());
		if (existing) return;

		const wrapper = this.commonUtils().createElementByParent(this.getId(), "div", element);

		const secondChild = element.children[1];
		if (secondChild) {
			element.insertBefore(wrapper, secondChild.nextSibling);
		}

		render(<LiveStreamersComponent currentPlatform="twitch" workerService={this.workerService()} />, wrapper);
	}
}
