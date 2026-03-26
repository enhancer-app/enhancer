import {
	FUNNY_AVATARS,
	FUNNY_CATEGORIES,
	FUNNY_NAMES,
	FUNNY_TITLES,
	FUNNY_TOOLTIPS,
} from "$shared/funny-thing/funny-things.ts";
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
		const funnyTooltip = FUNNY_TOOLTIPS[originalName] ?? "was definitely not changed by Enhancer";

		const username = element.querySelector<HTMLElement>('p[data-a-target="side-nav-title"]');
		if (username && funnyName && !username.hasAttribute("enhancer-hovering")) {
			username.setAttribute("enhancer-original", username.textContent ?? "");
			username.textContent = funnyName;
			username.title = `Name ${funnyTooltip}`;
			username.addEventListener("mouseenter", () => {
				username.setAttribute("enhancer-hovering", "true");
				username.textContent = username.getAttribute("enhancer-original") ?? username.textContent;
			});
			username.addEventListener("mouseleave", () => {
				username.removeAttribute("enhancer-hovering");
				username.textContent = funnyName;
			});
		}

		const avatar = element.querySelector<HTMLImageElement>(".side-nav-card__avatar img");
		if (avatar && funnyAvatar && !avatar.hasAttribute("enhancer-hovering")) {
			avatar.setAttribute("enhancer-original", avatar.src);
			avatar.src = funnyAvatar;
			avatar.title = `Avatar ${funnyTooltip}`;
			avatar.addEventListener("mouseenter", () => {
				avatar.setAttribute("enhancer-hovering", "true");
				avatar.src = avatar.getAttribute("enhancer-original") ?? avatar.src;
			});
			avatar.addEventListener("mouseleave", () => {
				avatar.removeAttribute("enhancer-hovering");
				avatar.src = funnyAvatar;
			});
		}
	}

	private replaceChannelInfo(element: Element) {
		const usernameElement = element.querySelector<HTMLElement>(".metadata-layout__support h1");
		const username = usernameElement?.textContent?.toLowerCase() ?? "";
		const funnyName = FUNNY_NAMES[username];
		const funnyAvatar = FUNNY_AVATARS[username];
		const funnyTitle = FUNNY_TITLES[username];
		const funnyCategory = FUNNY_CATEGORIES[username];
		const funnyTooltip = FUNNY_TOOLTIPS[username] ?? "was definitely not changed by Enhancer";

		if (usernameElement && funnyName && !usernameElement.hasAttribute("enhancer-hovering")) {
			usernameElement.setAttribute("enhancer-original", usernameElement.textContent ?? "");
			usernameElement.textContent = funnyName;
			usernameElement.title = `Name ${funnyTooltip}`;
			usernameElement.addEventListener("mouseenter", () => {
				usernameElement.setAttribute("enhancer-hovering", "true");
				usernameElement.textContent = usernameElement.getAttribute("enhancer-original") ?? usernameElement.textContent;
			});
			usernameElement.addEventListener("mouseleave", () => {
				usernameElement.removeAttribute("enhancer-hovering");
				usernameElement.textContent = funnyName;
			});
		}

		const avatar = element.querySelector<HTMLImageElement>("img.tw-image-avatar");
		if (avatar && funnyAvatar && !avatar.hasAttribute("enhancer-hovering")) {
			avatar.setAttribute("enhancer-original", avatar.src);
			avatar.src = funnyAvatar;
			avatar.title = `Avatar ${funnyTooltip}`;
			avatar.addEventListener("mouseenter", () => {
				avatar.setAttribute("enhancer-hovering", "true");
				avatar.src = avatar.getAttribute("enhancer-original") ?? avatar.src;
			});
			avatar.addEventListener("mouseleave", () => {
				avatar.removeAttribute("enhancer-hovering");
				avatar.src = funnyAvatar;
			});
		}

		const title = element.querySelector<HTMLElement>('p[data-a-target="stream-title"]');
		if (title && funnyTitle && !title.hasAttribute("enhancer-hovering")) {
			title.setAttribute("enhancer-original", title.textContent ?? "");
			title.textContent = funnyTitle;
			title.title = `Title ${funnyTooltip}`;
			title.addEventListener("mouseenter", () => {
				title.setAttribute("enhancer-hovering", "true");
				title.textContent = title.getAttribute("enhancer-original") ?? title.textContent;
			});
			title.addEventListener("mouseleave", () => {
				title.removeAttribute("enhancer-hovering");
				title.textContent = funnyTitle;
			});
		}

		const category = element.querySelector<HTMLElement>('a[data-a-target="stream-game-link"]');
		if (category && funnyCategory && !category.hasAttribute("enhancer-hovering")) {
			category.setAttribute("enhancer-original", category.textContent ?? "");
			category.textContent = funnyCategory;
			category.title = `Category ${funnyTooltip}`;
			category.addEventListener("mouseenter", () => {
				category.setAttribute("enhancer-hovering", "true");
				category.textContent = category.getAttribute("enhancer-original") ?? category.textContent;
			});
			category.addEventListener("mouseleave", () => {
				category.removeAttribute("enhancer-hovering");
				category.textContent = funnyCategory;
			});
		}
	}
}
