import type { ChatMessagePopupEvent } from "$types/platforms/twitch/twitch.events.types.ts";

export type ChatPopupVariant = "twitch" | "kick";

export type ChatPopupComponentProps = Omit<ChatMessagePopupEvent, "id"> & {
	variant: ChatPopupVariant;
};
