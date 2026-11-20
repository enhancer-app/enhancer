import KickModule from "$kick/kick.module.ts";
import { ChatMessageGroupingHelper } from "$shared/module/helpers/chat-message-grouping.helper.ts";
import type { KickChatMessageEvent } from "$types/platforms/kick/kick.events.types.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";

export default class ChatMessageGroupingModule extends KickModule {
	private static readonly HIDDEN_SELECTORS = ["div:has(> div > button[data-prevent-expand='true'])"];

	private helper?: ChatMessageGroupingHelper;

	readonly config: KickModuleConfig = {
		name: "chat-message-grouping",
		appliers: [
			{
				type: "event",
				key: "chat-message-grouping",
				event: "kick:chatMessage",
				callback: this.handleMessage.bind(this),
			},
			{
				type: "event",
				key: "chat-message-grouping-setting",
				event: "kick:settings:chatMessageGroupingEnabled",
				callback: (enabled: boolean) => this.helper?.setEnabled(enabled),
			},
		],
	};

	initialize() {
		this.helper = new ChatMessageGroupingHelper(ChatMessageGroupingModule.HIDDEN_SELECTORS);
		this.helper.setEnabled(this.settings().chatMessageGroupingEnabled);
	}

	private handleMessage({ element, message }: KickChatMessageEvent) {
		if (!this.helper) return;
		const index = Number(element.getAttribute("data-index") ?? Number.NaN);
		if (!element.parentElement || Number.isNaN(index)) return;
		this.helper.markRow(element, message.sender.id.toString(), message.type === "message");
		this.helper.updateRow(element, this.findRow(element.parentElement, index - 1));
		this.helper.updateRow(this.findRow(element.parentElement, index + 1), element);
	}

	private findRow(list: Element, index: number) {
		return list.querySelector(`:scope > [data-index="${index}"]`);
	}
}
