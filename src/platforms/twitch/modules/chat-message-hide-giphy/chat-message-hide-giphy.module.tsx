import type { TwitchChatMessageEvent } from "$types/platforms/twitch/twitch.events.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import TwitchModule from "../../twitch.module.ts";

export default class ChatMessageHideGiphy extends TwitchModule {
	readonly config: TwitchModuleConfig = {
		name: "chat-message-hide-giphy",
		enabled: () => this.settings().chatHideGiphyMessages,
		appliers: [
			{
				event: "twitch:chatMessage",
				callback: this.hideGiphyMessage.bind(this),
				key: "chat-message-hide-giphy",
				type: "event",
			},
		],
	};

	private hideGiphyMessage(message: TwitchChatMessageEvent) {
		if (!this.isModuleEnabled()) return;
		const shouldHide = this.isGiphyMessage(message);
		if (!shouldHide) return;
		this.hideMessage(message);
	}

	private isGiphyMessage(message: TwitchChatMessageEvent) {
		const { element } = message;
		const giphyNode = element.querySelectorAll("img");
		for (const node of giphyNode) {
			const src = node.getAttribute("src");
			if (!src) continue;
			const isGiphyUrl = this.isGiphyUrl(src);
			if (isGiphyUrl) return true;
		}
	}

	private isGiphyUrl(url: string) {
		try {
			const { host } = new URL(url);
			return host.includes("giphy");
		} catch {
			return false;
		}
	}

	private hideMessage(message: TwitchChatMessageEvent) {
		const { element } = message;
		if (!(element instanceof HTMLElement)) return;
		element.style.display = "none";
	}
}
