import type {
	EmoteBarClickAction,
	EmoteBarPointerEvent,
	EmoteBarSentMessage,
} from "$types/platforms/twitch/twitch.emote-bar.types.ts";

export const EMOTE_BAR_DUPLICATE_WINDOW = 30_000;
export const EMOTE_BAR_DUPLICATE_SUFFIX = " \u034F";

export function isMacPlatform(platform = globalThis.navigator?.platform ?? ""): boolean {
	return /Mac|iPhone|iPad|iPod/i.test(platform);
}

export function getEmoteClickAction(event: EmoteBarPointerEvent, isMac: boolean): EmoteBarClickAction {
	if (event.type === "contextmenu") return isMac && event.ctrlKey ? "send" : "remove";
	if (isMac) {
		if (event.metaKey) return "send";
		return event.ctrlKey ? "none" : "insert";
	}
	return event.ctrlKey ? "send" : "insert";
}

export function condenseWhitespace(message: string): string {
	return message.replace(/\s+/g, " ").trim();
}

export function buildEmoteMessage(
	name: string,
	previous: EmoteBarSentMessage | null,
	now: number,
	emoteOnly: boolean,
): string {
	if (emoteOnly || !previous || now - previous.at >= EMOTE_BAR_DUPLICATE_WINDOW) return name;
	return condenseWhitespace(previous.message) === name ? `${name}${EMOTE_BAR_DUPLICATE_SUFFIX}` : name;
}
