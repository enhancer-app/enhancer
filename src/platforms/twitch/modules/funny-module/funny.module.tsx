import { FUNNY_AVATARS, FUNNY_CATEGORIES, FUNNY_NAMES, FUNNY_TITLES } from "$shared/funny-thing/funny-things.ts";
import TwitchModule from "$twitch/twitch.module.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";

export default class FunnyModule extends TwitchModule {
	readonly config: TwitchModuleConfig = {
		name: "funny-module",
		appliers: [
			{
				type: "selector",
				selectors: ['#side-nav .side-nav-section .side-nav-card__link[data-test-selector="followed-channel"]'],
				callback: (elements) => elements.forEach((element) => this.replaceFollowedChannel(element)),
				key: "funny-module-replace-follows",
				once: true,
			},
			{
				type: "selector",
				selectors: ["section#live-channel-stream-information"],
				callback: (elements) => elements.forEach((element) => this.replaceChannelInfo(element)),
				key: "funny-module-replace-channel-info",
			},
		],
		isModuleEnabledCallback: async () => {
			return (await this.settingsService().getSettingsKey("_funnyThings")) && this.commonUtils().isFunnyDay();
		},
	};

	private replaceFollowedChannel(element: Element) {
		const url = (element as HTMLLinkElement).href;
		const originalName = url.substring(url.lastIndexOf("/") + 1);
		const funnyName = FUNNY_NAMES[originalName];
		const funnyAvatar = FUNNY_AVATARS[originalName];

		const username = element.querySelector<HTMLElement>('p[data-a-target="side-nav-title"]');
		if (username && funnyName) {
			username.textContent = funnyName;
			username.title = "Name was definitely not changed by Enhancer";
		}

		const avatar = element.querySelector<HTMLImageElement>(".side-nav-card__avatar img");
		if (avatar && funnyAvatar) {
			avatar.src = funnyAvatar;
			avatar.title = "Avatar was definitely not changed by Enhancer";
		}
	}

	private last = Date.now();

	private replaceChannelInfo(element: Element) {
		this.logger.debug(`runned, ${Date.now() - this.last}ms`);
		this.last = Date.now();

		const usernameElement = element.querySelector<HTMLElement>(".metadata-layout__support h1");
		const username = usernameElement?.textContent.toLowerCase() ?? "";
		const funnyName = FUNNY_NAMES[username];
		const funnyAvatar = FUNNY_AVATARS[username];
		const funnyTitle = FUNNY_TITLES[username];
		const funnyCategory = FUNNY_CATEGORIES[username];

		if (usernameElement && funnyName) {
			usernameElement.textContent = funnyName;
			usernameElement.title = "Name was definitely not changed by Enhancer";
		}

		const avatar = element.querySelector<HTMLImageElement>("img.tw-image-avatar");
		if (avatar && funnyAvatar) {
			avatar.src = funnyAvatar;
			avatar.title = "Avatar was definitely not changed by Enhancer";
		}

		const title = element.querySelector<HTMLElement>('p[data-a-target="stream-title"]');
		if (title && funnyTitle) {
			title.textContent = funnyTitle;
			title.title = "Title was definitely not changed by Enhancer";
		}

		const category = element.querySelector<HTMLElement>('a[data-a-target="stream-game-link"]');
		if (category && funnyCategory) {
			category.textContent = funnyCategory;
			category.title = "Category was definitely not changed by Enhancer";
		}
	}
}
