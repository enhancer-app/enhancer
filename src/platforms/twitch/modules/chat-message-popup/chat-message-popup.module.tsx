import { ChatPopupComponent } from "$shared/components/chat-popup/chat-popup.component.tsx";
import TwitchModule from "$twitch/twitch.module.ts";
import type { EnhancerMessageEvent } from "$types/apis/enhancer.apis.ts";
import type { ChatMessagePopupEvent } from "$types/platforms/twitch/twitch.events.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import { render } from "preact";

export default class ChatMessagePopupModule extends TwitchModule {
	static readonly TWITCHTV_CHAT_SELECTOR = ".chat-list--default";
	static readonly SEVENTV_CHAT_SELECTOR = "seventv-container.seventv-chat-list";
	private static readonly DEFAULT_POPUP_ID = "default";

	config: TwitchModuleConfig = {
		name: "message-popup",
		appliers: [
			{
				type: "event",
				event: "twitch:chatPopupMessage",
				callback: this.render.bind(this),
				key: "message-popup",
			},
			{
				type: "event",
				event: "twitch:chatPopupClose",
				callback: this.close.bind(this),
				key: "message-popup-close",
			},
			{
				type: "event",
				event: "extension:enhancer-api-message",
				callback: this.renderEnhancerMessage.bind(this),
				key: "enhancer-message-popup",
			},
		],
	};

	private renderEnhancerMessage(message: EnhancerMessageEvent) {
		const text =
			typeof message.data === "object" &&
			message.data !== null &&
			"text" in message.data &&
			typeof message.data.text === "string"
				? message.data.text
				: null;
		if (!text?.trim()) return;
		this.render({ title: "Enhancer", content: text, autoclose: text.length > 120 ? 30 : 10 });
	}

	private findPopup(id: string): HTMLElement | null {
		return document.querySelector(`.${this.getId()}[data-popup-id="${CSS.escape(id)}"]`);
	}

	private close(id: string) {
		const wrapper = this.findPopup(id);
		if (!wrapper) return;
		render(null, wrapper);
		wrapper.remove();
	}

	private render(message: ChatMessagePopupEvent) {
		const contentElement =
			document.querySelector(ChatMessagePopupModule.SEVENTV_CHAT_SELECTOR) ??
			document.querySelector(ChatMessagePopupModule.TWITCHTV_CHAT_SELECTOR);
		if (!contentElement) {
			this.logger.error("Failed to render component in chat");
			return;
		}

		const id = message.id ?? ChatMessagePopupModule.DEFAULT_POPUP_ID;
		this.close(id);
		const wrapper = this.commonUtils().createElementByParent(this.getId(), "span", contentElement);
		wrapper.dataset.popupId = id;
		render(
			<ChatPopupComponent
				variant="twitch"
				title={message.title}
				content={message.content}
				compactContent={message.compactContent}
				appearance={message.appearance}
				progress={message.progress}
				autoclose={message.autoclose ?? 15}
				onClose={() => {
					this.close(id);
					message.onClose?.();
				}}
			/>,
			wrapper,
		);
	}
}
