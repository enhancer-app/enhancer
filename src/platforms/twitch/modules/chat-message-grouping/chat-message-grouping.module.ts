import { ChatMessageGroupingHelper } from "$shared/module/helpers/chat-message-grouping.helper.ts";
import ChatModule from "$twitch/modules/chat/chat.module.tsx";
import TwitchModule from "$twitch/twitch.module.ts";
import type { TwitchChatMessageEvent } from "$types/platforms/twitch/twitch.events.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";

export default class ChatMessageGroupingModule extends TwitchModule {
	private static readonly LIST_SELECTOR = `${ChatModule.TWITCHTV_CHAT_SELECTOR}, ${ChatModule.SEVENTV_CHAT_SELECTOR}`;
	private static readonly HIDDEN_SELECTORS = [
		".chat-line__timestamp",
		".chat-line__username-container",
		".chat-line__message--badges",
		".chat-line__username",
		".chat-line__username-container + span[aria-hidden='true']",
		".chat-line__username + span[aria-hidden='true']",
		".seventv-chat-message-timestamp",
		".seventv-chat-user",
		".seventv-chat-user + span",
	];

	private helper?: ChatMessageGroupingHelper;

	readonly config: TwitchModuleConfig = {
		name: "chat-message-grouping",
		appliers: [
			{
				type: "event",
				key: "chat-message-grouping",
				event: "twitch:chatMessage",
				callback: this.handleMessage.bind(this),
			},
			{
				type: "event",
				key: "chat-message-grouping-setting",
				event: "twitch:settings:chatMessageGroupingEnabled",
				callback: (enabled: boolean) => this.helper?.setEnabled(enabled),
			},
		],
	};

	initialize() {
		this.helper = new ChatMessageGroupingHelper(ChatMessageGroupingModule.HIDDEN_SELECTORS);
		this.helper.setEnabled(this.settings().chatMessageGroupingEnabled);
	}

	private handleMessage({ element, message }: TwitchChatMessageEvent) {
		if (!this.helper) return;
		const row = this.findRow(element);
		if (!row) return;
		this.helper.markRow(row, message.user.userID, !message.reply);
		this.helper.updateRow(row, row.previousElementSibling);
		this.helper.updateRow(row.nextElementSibling, row);
	}

	private findRow(element: Element): Element | null {
		let row = element;
		while (row.parentElement) {
			if (row.parentElement.matches(ChatMessageGroupingModule.LIST_SELECTOR)) return row;
			row = row.parentElement;
		}
		return null;
	}
}
