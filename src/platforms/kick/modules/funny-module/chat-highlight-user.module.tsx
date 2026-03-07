import KickModule from "$kick/kick.module.ts";
import { KICK_FUNNY_IMAGES, KICK_FUNNY_NAMES } from "$shared/april-thing/nicknames.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";

export default class FunnyModule extends KickModule {
	readonly config: KickModuleConfig = {
		name: "chat-highlight-user",
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
	};

	private replaceChannelName(elements: Element[]) {
		elements.forEach((_element) => {
			const element = _element as HTMLElement;
			const originalName = element.textContent || "";
			const currentUsername = originalName.toLowerCase().trim();
			const funnyName = KICK_FUNNY_NAMES[currentUsername];

			if (funnyName) {
				element.textContent = funnyName;
				element.title = "Name was definitely not changed by Enhancer";
				element.addEventListener("mouseenter", () => {
					element.textContent = originalName;
				});
				element.addEventListener("mouseleave", () => {
					element.textContent = funnyName;
				});
			}
		});
	}

	private replaceAvatar(elements: Element[]) {
		elements.forEach((_element) => {
			const element = _element as HTMLImageElement;
			const originalName = element.alt || "";
			const originalImage = element.src;
			const currentUsername = originalName.toLowerCase().trim();
			const funnyImage = KICK_FUNNY_IMAGES[currentUsername];

			if (funnyImage) {
				element.src = funnyImage;
				element.title = "Avatar was definitely not changed by Enhancer";
				element.addEventListener("mouseenter", () => {
					element.src = originalImage;
				});
				element.addEventListener("mouseleave", () => {
					element.src = funnyImage;
				});
			}
		});
	}
}
