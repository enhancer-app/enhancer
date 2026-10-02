import type { TwitchChatMessage } from "$types/platforms/twitch/twitch.events.types.ts";

export type TestMessageHandlerApi = {
	addMessageHandler: () => void;
	handleMessage: (this: TestMessageHandlerApi, ...messages: TwitchChatMessage[]) => string;
};
