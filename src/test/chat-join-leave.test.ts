import { expect, test } from "bun:test";
import { formatChatJoinLeave } from "$twitch/modules/chat-join-leave/chat-join-leave.component.tsx";
import { extractMembership } from "$twitch/modules/chat-join-leave/chat-join-leave.irc.ts";

const line = (login: string, command: string, channel = "kasix") =>
	`:${login}!${login}@${login}.tmi.twitch.tv ${command} #${channel}`;

test("other users' membership lines are removed and only the current channel is queued", () => {
	const data = [
		line("alice", "JOIN"),
		"@badge-info=;id=1 :bob!bob@bob.tmi.twitch.tv PRIVMSG #kasix :hi",
		line("carol", "PART"),
		line("dave", "JOIN", "other"),
		"",
	].join("\r\n");

	const result = extractMembership(data, "kasix", "me");

	expect(result.data).toBe(["@badge-info=;id=1 :bob!bob@bob.tmi.twitch.tv PRIVMSG #kasix :hi", ""].join("\r\n"));
	expect(result.events).toEqual([
		{ login: "alice", action: "join" },
		{ login: "carol", action: "leave" },
	]);
});

test("the current user's and anonymous JOIN lines stay for Twitch's client", () => {
	const data = [line("me", "JOIN"), line("justinfan12345", "JOIN"), line("alice", "JOIN")].join("\r\n");

	const result = extractMembership(data, "kasix", "me");

	expect(result.data).toBe([line("me", "JOIN"), line("justinfan12345", "JOIN")].join("\r\n"));
	expect(result.events).toEqual([{ login: "alice", action: "join" }]);
});

test("membership lines are still removed when the channel is unknown", () => {
	const result = extractMembership(line("alice", "JOIN"), undefined, undefined);

	expect(result.data).toBe("");
	expect(result.events).toEqual([]);
});

test("small batches list names and larger ones show counts", () => {
	expect(formatChatJoinLeave({ joined: ["alice", "bob"], left: ["carol"] })).toBe("+alice +bob −carol");
	expect(formatChatJoinLeave({ joined: ["a", "b", "c"], left: ["d"] })).toBe("3 joined, 1 left");
	expect(formatChatJoinLeave({ joined: ["a", "b", "c", "d"], left: [] })).toBe("4 joined");
});
