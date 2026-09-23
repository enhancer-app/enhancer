import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import TwitchModule from "../../twitch.module.ts";

export default class HideStoriesModule extends TwitchModule {
	private readonly hiddenElements = new Set<HTMLElement>();

	readonly config: TwitchModuleConfig = {
		name: "hide-stories",
		enabled: () => this.settings().hideStories,
		appliers: [
			{
				type: "selector",
				selectors: ['#side-nav div[class*="storiesLeftNavSection"]'],
				callback: this.hideElements.bind(this),
				key: "hide-stories",
			},
			{
				type: "selector",
				selectors: ['#side-nav [class*="saveYourStreakSideNavRow"]'],
				callback: this.hideElements.bind(this),
				key: "hide-stories-streak",
				useParent: true,
			},
			{
				type: "event",
				event: "extension:settings-refresh",
				callback: this.handleSettingsRefresh.bind(this),
				key: "hide-stories-setting",
			},
		],
	};

	private hideElements(elements: Element[]) {
		for (const element of elements) {
			this.hideElement(element as HTMLElement);
		}
	}

	private hideElement(element: HTMLElement) {
		const isHidden =
			element.style.getPropertyValue("display") === "none" &&
			element.style.getPropertyPriority("display") === "important";
		if (!isHidden) element.style.setProperty("display", "none", "important");
		this.hiddenElements.add(element);
	}

	private handleSettingsRefresh() {
		if (this.settings().hideStories) return;
		for (const element of this.hiddenElements) {
			element.style.removeProperty("display");
		}
		this.hiddenElements.clear();
	}
}
