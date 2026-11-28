import type {
	ChatJoinLeaveEvent,
	ChatJoinLeaveIrcResult,
} from "$types/platforms/twitch/twitch.chat-join-leave.types.ts";

const MEMBERSHIP_LINE = /^:(\w+)!\w+@\w+\.tmi\.twitch\.tv (JOIN|PART) #(\w+)$/;

// Twitch's client shows a welcome line for any JOIN it reads, so every other user's JOIN/PART is removed.
export function extractMembership(
	data: string,
	channel: string | undefined,
	currentUser: string | undefined,
): ChatJoinLeaveIrcResult {
	const kept: string[] = [];
	const events: ChatJoinLeaveEvent[] = [];
	for (const line of data.split("\r\n")) {
		const match = MEMBERSHIP_LINE.exec(line);
		const login = match?.[1].toLowerCase();
		if (!match || !login || login === currentUser || login.startsWith("justinfan")) {
			kept.push(line);
			continue;
		}
		if (channel && match[3].toLowerCase() === channel) {
			events.push({ login, action: match[2] === "JOIN" ? "join" : "leave" });
		}
	}
	return { data: kept.join("\r\n"), events };
}
