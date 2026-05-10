import type { MessageMenuEvent } from "$shared/components/message-menu/message-menu.component.tsx";
import type { CommonEvents } from "$types/platforms/common.events.ts";
import type { TwitchSettingsEvents } from "$types/platforms/twitch/twitch.settings.types.ts";
import type { ComponentChildren } from "preact";

export type TwitchEvents = {
	"twitch:chatInitialized": (channelId: string) => void | Promise<void>;
	"twitch:chatMessage": (message: TwitchChatMessageEvent) => void | Promise<void>;
	"twitch:chatPopupMessage": (message: ChatMessagePopupEvent) => void | Promise<void>;
	"twitch:messageMenu": (message: MessageMenuEvent) => void | Promise<void>;
	"twitch:pinnedStreamer:sync": (payload: TwitchPinnedStreamerSyncEvent) => void | Promise<void>;
} & TwitchSettingsEvents &
	CommonEvents;

export type TwitchPinnedStreamerSyncEvent = {
	channelId: string;
	isPinned: boolean;
};

export type TwitchChatMessage = {
	badges: Record<string, string>;
	id: string;
	nonce: string;
	user: TwitchChatMessageUser;
	isVip: boolean | undefined;
	isFirstMsg: boolean | undefined;
	isHistorical: boolean | undefined;
	message?: string;
	messageBody?: string;
	timestamp: number;
	type: number;
	createdAt: number;
};

export type TwitchChatMessageUser = {
	userID: string;
	userDisplayName: string;
	userLogin: string;
	color: string;
	isSubscriber: boolean;
};

export type ChatType = "TWITCH" | "7TV";

export type TwitchChatMessageEvent = {
	message: TwitchChatMessage;
	element: Element;
	type: ChatType;
};

export type ChatMessagePopupEvent = {
	title: string;
	content: ComponentChildren;
	autoclose?: number;
	onClose?: () => void;
};
