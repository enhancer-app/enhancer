import KickModule from "$kick/kick.module.ts";
import { FUNNY_AVATARS, FUNNY_NAMES } from "$shared/funny-thing/funny-things.ts";
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

			if (funnyName) {
				element.textContent = funnyName;
				element.title = "Name was definitely not changed by Enhancer";
			}
		});
	}

	private replaceAvatar(elements: Element[]) {
		elements.forEach((_element) => {
			const element = _element as HTMLImageElement;
			const originalName = element.alt || "";
			const currentUsername = originalName.toLowerCase().trim();
			const funnyImage = FUNNY_AVATARS[currentUsername];

			if (funnyImage) {
				element.src = funnyImage;
				element.title = "Avatar was definitely not changed by Enhancer";
			}
		});
	}
}
