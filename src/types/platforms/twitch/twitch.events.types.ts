import type { MessageMenuEvent } from "$shared/components/message-menu/message-menu.component.tsx";
import type { CommonEvents } from "$types/platforms/common.events.ts";
import type { TwitchSettingsEvents } from "$types/platforms/twitch/twitch.settings.types.ts";
import type { ReadonlySignal } from "@preact/signals";
import type { ComponentChildren } from "preact";

export type TwitchEvents = {
	"twitch:chatInitialized": (channelId: string) => void | Promise<void>;
	"twitch:chatMessage": (message: TwitchChatMessageEvent) => void | Promise<void>;
	"twitch:chatPopupMessage": (message: ChatMessagePopupEvent) => void | Promise<void>;
	"twitch:chatPopupClose": (id: string) => void | Promise<void>;
	"twitch:messageMenu": (message: MessageMenuEvent) => void | Promise<void>;
	"twitch:pinnedStreamer:sync": (payload: TwitchPinnedStreamerSyncEvent) => void | Promise<void>;
} & TwitchSettingsEvents &
	CommonEvents;

export type TwitchPinnedStreamerSyncEvent = {
	channelId: string;
	isPinned: boolean;
	source?: "channel-section" | "pin-streamer";
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
	isReplay: boolean;
};

export type ChatMessagePopupEvent = {
	id?: string;
	title: ComponentChildren;
	content: ComponentChildren;
	compactContent?: (expand: () => void) => ComponentChildren;
	autoclose?: number | ReadonlySignal<number | null>;
	appearance?: "default" | "card";
	progress?: ReadonlySignal<number | null>;
	onClose?: () => void;
};
