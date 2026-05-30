import type { TwitchChatMessageEvent } from "$types/platforms/twitch/twitch.events.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import TwitchModule from "../../twitch.module.ts";

export default class ChatCopyEmoteModule extends TwitchModule {
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

	private async handleMessage({ element }: TwitchChatMessageEvent) {
		if (this.twitchUtils().is7TV()) {
			await this.commonUtils().delay(5);
		}
		const emotes = element.querySelectorAll(".seventv-emote .seventv-chat-emote, .chat-line__message--emote");
		if (emotes.length < 1) return;

		emotes.forEach((emote) => {
			emote.addEventListener("contextmenu", (event) => {
				event.preventDefault();
				const altValue = emote.getAttribute("alt");
				if (altValue) {
					const name = altValue.replace(/ /g, "");
					this.twitchUtils().addTextToChatInput(name);
				}
			});
		});
	}
}
