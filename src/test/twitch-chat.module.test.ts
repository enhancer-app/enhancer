import { expect, test } from "bun:test";
import ChatModule from "$twitch/modules/chat/chat.module.tsx";
import type { TwitchChatMessage } from "$types/platforms/twitch/twitch.events.types.ts";

test("finalizes a queued 7TV message id", () => {
	const chatModule = new ChatModule(
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
	);
	const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
	const originalCss = Object.getOwnPropertyDescriptor(globalThis, "CSS");
	Object.defineProperty(globalThis, "document", {
		configurable: true,
		value: { querySelector: () => null },
	});
	Object.defineProperty(globalThis, "CSS", {
		configurable: true,
		value: { escape: (value: string) => value },
	});

	const message = {
		badges: {},
		id: "",
		nonce: "message-nonce",
		user: {
			userID: "user-id",
			userDisplayName: "User Name",
			userLogin: "user-name",
			color: "#9147ff",
			isSubscriber: false,
		},
		isVip: false,
		isFirstMsg: false,
		isHistorical: false,
		message: "message",
		timestamp: 1,
		type: 0,
		createdAt: 1,
	} satisfies TwitchChatMessage;

	try {
		(chatModule as any).bufferSevenTvMessage(message);
		(chatModule as any).bufferSevenTvMessage({ ...message, id: "final-id", type: 51 });

		expect((chatModule as any).sevenTvMessageQueue.get("final-id").id).toBe("final-id");
	} finally {
		if (originalDocument) {
			Object.defineProperty(globalThis, "document", originalDocument);
		} else {
			Reflect.deleteProperty(globalThis, "document");
		}
		if (originalCss) {
			Object.defineProperty(globalThis, "CSS", originalCss);
		} else {
			Reflect.deleteProperty(globalThis, "CSS");
		}
	}
});
