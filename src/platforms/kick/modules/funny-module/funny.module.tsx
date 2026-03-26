import KickModule from "$kick/kick.module.ts";
import { FUNNY_AVATARS, FUNNY_NAMES, FUNNY_TOOLTIPS } from "$shared/funny-thing/funny-things.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";

export default class FunnyModule extends KickModule {
	readonly config: KickModuleConfig = {
		name: "funny-module",
		appliers: [
			{
				type: "selector",
				selectors: ["h1#channel-username"],
				callback: this.replaceChannelName.bind(this),
				key: "chat",
				once: true,
			},
			{
				type: "selector",
				selectors: ["#sidebar-wrapper a span.shrink"],
				callback: this.replaceChannelName.bind(this),
				key: "chat",
				once: true,
			},
			{
				type: "selector",
				selectors: ["#sidebar-wrapper a img"],
				callback: this.replaceAvatar.bind(this),
				key: "chat",
				once: true,
			},
			{
				type: "selector",
				selectors: ["#channel-avatar"],
				callback: this.replaceAvatar.bind(this),
				key: "chat",
				once: true,
			},
		],
		isModuleEnabledCallback: async () => {
			return (await this.settingsService().getSettingsKey("_funnyThings")) && this.commonUtils().isFunnyDay();
		},
	};

	private replaceChannelName(elements: Element[]) {
		elements.forEach((_element) => {
			const element = _element as HTMLElement;
			const originalName = element.textContent || "";
			const currentUsername = originalName.toLowerCase().trim();
			const funnyName = FUNNY_NAMES[currentUsername];
			const funnyTooltip = FUNNY_TOOLTIPS[currentUsername] ?? "was definitely not changed by Enhancer";

			if (funnyName && !element.hasAttribute("enhancer-hovering")) {
				element.setAttribute("enhancer-original", element.textContent ?? "");
				element.textContent = funnyName;
				element.title = `Name ${funnyTooltip}`;

				element.addEventListener("mouseenter", () => {
					element.setAttribute("enhancer-hovering", "true");
					element.textContent = element.getAttribute("enhancer-original") ?? element.textContent;
				});
				element.addEventListener("mouseleave", () => {
					element.removeAttribute("enhancer-hovering");
					element.textContent = funnyName;
				});
			}
		});
	}

	private replaceAvatar(elements: Element[]) {
		elements.forEach((_element) => {
			const element = _element as HTMLImageElement;
			const originalName = element.alt || "";
			const currentUsername = originalName.toLowerCase().trim();
			const funnyImage = FUNNY_AVATARS[currentUsername];
			const funnyTooltip = FUNNY_TOOLTIPS[currentUsername] ?? "was definitely not changed by Enhancer";

			if (funnyImage && !element.hasAttribute("enhancer-hovering")) {
				element.setAttribute("enhancer-original", element.src);
				element.src = funnyImage;
				element.title = `Avatar ${funnyTooltip}`;

				element.addEventListener("mouseenter", () => {
					element.setAttribute("enhancer-hovering", "true");
					element.src = element.getAttribute("enhancer-original") ?? element.src;
				});
				element.addEventListener("mouseleave", () => {
					element.removeAttribute("enhancer-hovering");
					element.src = funnyImage;
				});
			}
		});
	}
}
