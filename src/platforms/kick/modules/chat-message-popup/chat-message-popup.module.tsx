import KickModule from "$kick/kick.module.ts";
import { ChatPopupComponent } from "$shared/components/chat-popup/chat-popup.component.tsx";
import type { EnhancerMessageEvent } from "$types/apis/enhancer.apis.ts";
import type { ChatMessagePopupEvent } from "$types/platforms/twitch/twitch.events.types.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";
import { render } from "preact";

export default class ChatMessagePopupModule extends KickModule {
	private static readonly DEFAULT_POPUP_ID = "default";

	config: KickModuleConfig = {
		name: "message-popup",
		appliers: [
			{
				type: "event",
				event: "kick:chatPopupMessage",
				callback: this.render.bind(this),
				key: "message-popup",
			},
			{
				type: "event",
				event: "kick:chatPopupClose",
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
		const contentElement = document.querySelector("#chatroom-footer");
		if (!contentElement) {
			this.logger.error("Failed to render component in chat");
			return;
		}

		const id = message.id ?? ChatMessagePopupModule.DEFAULT_POPUP_ID;
		this.close(id);
		const wrapper = document.createElement("div");
		wrapper.classList.add(this.getId());
		wrapper.dataset.popupId = id;
		contentElement.insertBefore(wrapper, contentElement.firstElementChild);
		render(
			<ChatPopupComponent
				variant="kick"
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
