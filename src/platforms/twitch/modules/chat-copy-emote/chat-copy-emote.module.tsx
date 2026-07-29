import type { TwitchChatMessageEvent } from "$types/platforms/twitch/twitch.events.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import TwitchModule from "../../twitch.module.ts";

export default class ChatCopyEmoteModule extends TwitchModule {
	private readonly listenerControllers = new WeakMap<Element, AbortController>();

	readonly config: TwitchModuleConfig = {
		name: "chat-copy-emote",
		appliers: [
			{
				type: "event",
				key: "chat-copy-emote",
				event: "twitch:chatMessage",
				callback: this.handleMessage.bind(this),
			},
		],
	};

	private handleMessage({ element }: TwitchChatMessageEvent) {
		this.listenerControllers.get(element)?.abort();
		const controller = new AbortController();
		this.listenerControllers.set(element, controller);
		const emoteSelector = ".seventv-emote, .seventv-chat-emote, .chat-line__message--emote, .ffz-emote";
		element.addEventListener(
			"contextmenu",
			(event) => {
				if (!(event.target instanceof Element)) return;

				const directEmote = event.target.closest(emoteSelector);
				const wrapper = event.target.closest(".seventv-emote-box");
				const emote = directEmote ?? wrapper?.querySelector(emoteSelector);
				if (!(emote instanceof Element) || !element.contains(emote)) return;

				const name = emote.getAttribute("alt")?.trim();
				if (!name) return;

				event.preventDefault();
				event.stopImmediatePropagation();
				this.twitchUtils().addTextToChatInput(name);
			},
			{ capture: true, signal: controller.signal },
		);
	}
}
