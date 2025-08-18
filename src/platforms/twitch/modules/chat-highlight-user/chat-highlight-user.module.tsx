import type { TwitchChatMessageEvent } from "$types/platforms/twitch/twitch.events.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import TwitchModule from "../../twitch.module.ts";

export default class ChatHighlightUserModule extends TwitchModule {
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
		this.commonUtils().createGlobalStyle(".enhancer-highlighted-user-message { background-color: #444 !important; }");
	}

	private handleMessage({ element }: TwitchChatMessageEvent) {
		const mentions = [
			...Array.from(element.querySelectorAll(".chat-line__message-mention")),
			...Array.from(element.querySelectorAll(".mention-fragment")),
			...Array.from(element.querySelectorAll(".seventv-chat-message-body .mention-token")),
		].filter((mention) => !mention.hasAttribute("enhancer-mention-user"));
		if (mentions.length < 1) return;
		for (const mention of mentions) {
			const mentionElement = mention as HTMLElement;
			const username = mentionElement.textContent?.replace("@", "").toLowerCase() || "";
			mentionElement.setAttribute("enhancer-mention-user", username);
			mentionElement.addEventListener("mouseover", this.highlightUserMentions.bind(this));
			mentionElement.addEventListener("mouseout", this.removeHighlightedUserMentions.bind(this));
		}
	}

	private highlightUserMentions(event: MouseEvent): void {
		// todo change color to red of mention is not 7tv
		const target = event.currentTarget as HTMLElement;
		const username = target.getAttribute("enhancer-mention-user");
		if (!username) return;
		this.logger.debug(`Highlighting ${username} messages`);

		[...document.querySelectorAll(".chat-line__message"), ...document.querySelectorAll(".seventv-message")].forEach(
			(messageElement) => {
				const authorElement =
					messageElement.querySelector(".chat-author__display-name") ??
					messageElement.querySelector(".seventv-chat-user-username");
				if (!authorElement) return;

				const authorName = authorElement.textContent?.toLowerCase() || "";
				if (authorName === username) {
					messageElement.classList.add("enhancer-highlighted-user-message");
				}
			},
		);
	}

	private removeHighlightedUserMentions(): void {
		this.logger.debug("Removing highlighted messages");
		document
			.querySelectorAll(".enhancer-highlighted-user-message")
			.forEach((message) => message.classList.remove("enhancer-highlighted-user-message"));
	}
}
