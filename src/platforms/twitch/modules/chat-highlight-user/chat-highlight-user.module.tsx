import type { TwitchChatMessageEvent } from "$types/platforms/twitch/twitch.events.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import TwitchModule from "../../twitch.module.ts";

export default class ChatHighlightUserModule extends TwitchModule {
	static readonly MENTION_SELECTOR =
		".chat-line__message-mention, .mention-fragment, .seventv-chat-message-body .mention-token";
	static readonly MENTION_USER_ATTRIBUTE = "enhancer-mention-user";
	static readonly HIGHLIGHTED_CLASS = "enhancer-highlighted-user-message";

	private readonly highlightedMessages = new Set<Element>();

	readonly config: TwitchModuleConfig = {
		name: "chat-highlight-user",
		appliers: [
			{
				type: "event",
				key: "chat-highlight-user",
				event: "twitch:chatMessage",
				callback: this.handleMessage.bind(this),
			},
		],
	};

	async initialize(): Promise<void> {
		this.commonUtils().createGlobalStyle(
			`.${ChatHighlightUserModule.HIGHLIGHTED_CLASS} { background-color: #444 !important; }`,
		);
		document.addEventListener("mouseover", this.handleMouseOver.bind(this));
		document.addEventListener("mouseout", this.handleMouseOut.bind(this));
	}

	private handleMessage({ element }: TwitchChatMessageEvent) {
		for (const mention of element.querySelectorAll(ChatHighlightUserModule.MENTION_SELECTOR)) {
			if (mention.hasAttribute(ChatHighlightUserModule.MENTION_USER_ATTRIBUTE)) continue;
			const username = mention.textContent?.replace("@", "").toLowerCase() || "";
			mention.setAttribute(ChatHighlightUserModule.MENTION_USER_ATTRIBUTE, username);
		}
	}

	private findMention(event: MouseEvent): Element | null {
		const target = event.target;
		if (!(target instanceof Element)) return null;
		return target.closest(`[${ChatHighlightUserModule.MENTION_USER_ATTRIBUTE}]`);
	}

	private handleMouseOver(event: MouseEvent): void {
		const mention = this.findMention(event);
		if (!mention) return;
		const username = mention.getAttribute(ChatHighlightUserModule.MENTION_USER_ATTRIBUTE);
		if (!username) return;

		for (const messageElement of document.querySelectorAll(".chat-line__message, .seventv-message")) {
			const authorElement =
				messageElement.querySelector(".chat-author__display-name") ??
				messageElement.querySelector(".seventv-chat-user-username");
			if (!authorElement) continue;
			if ((authorElement.textContent?.toLowerCase() || "") !== username) continue;
			messageElement.classList.add(ChatHighlightUserModule.HIGHLIGHTED_CLASS);
			this.highlightedMessages.add(messageElement);
		}
	}

	private handleMouseOut(event: MouseEvent): void {
		if (!this.findMention(event)) return;
		for (const message of this.highlightedMessages) {
			message.classList.remove(ChatHighlightUserModule.HIGHLIGHTED_CLASS);
		}
		this.highlightedMessages.clear();
	}
}
