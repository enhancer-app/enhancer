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
		const emotes = element.querySelectorAll(".seventv-emote, .seventv-chat-emote, .chat-line__message--emote");
		if (emotes.length < 1) return;
		emotes.forEach((emote) => {
			this.listenerControllers.get(emote)?.abort();
			const controller = new AbortController();
			this.listenerControllers.set(emote, controller);
			emote.addEventListener(
				"contextmenu",
				(event) => {
					event.preventDefault();
					const altValue = emote.getAttribute("alt");
					if (altValue) {
						const name = altValue.replace(/ /g, "");
						this.twitchUtils().addTextToChatInput(name);
					}
				},
				{ signal: controller.signal },
			);
		});
	}
}
