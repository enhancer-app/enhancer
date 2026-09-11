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
				callback: this.handleMessage.bind(this),
				key: "chat-message-hide-giphy",
				type: "event",
			},
		],
	};

	private handleMessage(message: TwitchChatMessageEvent) {
		if (!this.isModuleEnabled()) return;
		const image = this.getGiphyImage(message);
		if (!image) return;
		if (this.settings().chatGiphyMessageMode === "link") {
			this.replaceGiphyWithLink(image);
			return;
		}
		this.hideMessage(message);
	}

	private getGiphyImage(message: TwitchChatMessageEvent) {
		return message.element.querySelector<HTMLImageElement>(
			[
				'[data-a-target="chat-line-message-body"] img[class*="gifImage--"]',
				".seventv-chat-message-body img.seventv-chat-gif",
				".ffz--gif-embed img.ffz--gif-embed__image",
			].join(", "),
		);
	}

	private replaceGiphyWithLink(image: HTMLImageElement) {
		const container =
			image.closest(
				'.ffz--gif-embed-wrapper, .seventv-chat-gif-container, [data-a-target="chat-line-message-body"] > [class*="container--"]',
			) ?? image;
		const link = document.createElement("a");
		link.className = "enhancer-giphy-link";
		link.textContent = image.alt.trim() || "GIF";
		if (image.getAttribute("src")?.trim() && /^https?:\/\//i.test(image.src)) {
			link.href = image.src;
			link.target = "_blank";
			link.rel = "noopener noreferrer";
		}
		container.replaceWith(link);
	}

	private hideMessage(message: TwitchChatMessageEvent) {
		const { element } = message;
		if (!(element instanceof HTMLElement)) return;
		element.style.display = "none";
	}
}
