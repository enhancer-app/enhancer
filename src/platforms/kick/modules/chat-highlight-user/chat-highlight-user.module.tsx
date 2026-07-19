import KickModule from "$kick/kick.module.ts";
import type { KickChatMessageEvent } from "$types/platforms/kick/kick.events.types.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";

export default class ChatHighlightUserModule extends KickModule {
	static readonly HIGHLIGHT_COLORS = [
		"rgba(255, 107, 107, 0.1)",
		"rgba(78, 205, 196, 0.1)",
		"rgba(69, 183, 209, 0.1)",
		"rgba(150, 206, 180, 0.1)",
		"rgba(254, 202, 87, 0.1)",
		"rgba(255, 159, 243, 0.1)",
		"rgba(84, 160, 255, 0.1)",
		"rgba(95, 39, 205, 0.1)",
		"rgba(0, 210, 211, 0.1)",
		"rgba(255, 159, 67, 0.1)",
	];
	private currentColorIndex = 0;
	private readonly listenerControllers = new WeakMap<HTMLElement, AbortController>();

	readonly config: KickModuleConfig = {
		name: "chat-highlight-user",
		appliers: [
			{
				type: "event",
				key: "chat-highlight-user",
				event: "kick:chatMessage",
				callback: this.handleMessage.bind(this),
			},
		],
	};

	private handleMessage({ message, element }: KickChatMessageEvent) {
		const messageElement = element as HTMLElement;
		const isHovered = messageElement.matches(":hover");
		if (isHovered) this.removeHighlightedUserMentions();
		this.listenerControllers.get(messageElement)?.abort();
		const mentionRegex = /@(\w+)/g;
		const mentions = [...message.content.matchAll(mentionRegex)];
		if (mentions.length === 0) return;

		const mentionedUsernames = mentions.map((match) => match[1].toLowerCase());
		this.logger.debug(`Highlighting ${mentionedUsernames.length} users: ${mentionedUsernames.join(", ")}`);

		const controller = new AbortController();
		this.listenerControllers.set(messageElement, controller);
		messageElement.addEventListener("mouseenter", () => this.highlightUserMentions(mentionedUsernames), {
			signal: controller.signal,
		});
		messageElement.addEventListener("mouseleave", this.removeHighlightedUserMentions.bind(this), {
			signal: controller.signal,
		});
		if (isHovered) this.highlightUserMentions(mentionedUsernames);
	}

	private highlightUserMentions(usernames: string[]): void {
		const highlightedUsers = new Map<string, string>();
		usernames.forEach((username) => {
			if (!highlightedUsers.has(username)) {
				const color =
					ChatHighlightUserModule.HIGHLIGHT_COLORS[
						this.currentColorIndex % ChatHighlightUserModule.HIGHLIGHT_COLORS.length
					];
				highlightedUsers.set(username, color);
				this.currentColorIndex++;
			}
		});

		const chatMessages = document.querySelectorAll("#channel-chatroom .ntv__chat-message, div[data-index]");
		chatMessages.forEach((messageElement) => {
			const authorElement =
				messageElement.querySelector(".ntv__chat-message__username") ||
				messageElement.querySelector('button[data-prevent-expand="true"]');
			if (!authorElement) return;

			const username =
				(authorElement as HTMLElement).dataset.enhancerUsername || authorElement.textContent?.toLowerCase() || "";

			if (!usernames.includes(username)) return;
			const color = highlightedUsers.get(username);
			if (!color) return;
			(messageElement as HTMLElement).style.backgroundColor = color;
			messageElement.classList.add("enhancer-highlighted-user");
		});
	}

	private removeHighlightedUserMentions(): void {
		this.logger.debug("Removing highlighted messages");
		[...document.querySelectorAll(".enhancer-highlighted-user")].forEach((element) => {
			element.classList.remove("enhancer-highlighted-user");
			(element as HTMLElement).style.backgroundColor = "";
		});
		this.currentColorIndex = 0;
	}
}
