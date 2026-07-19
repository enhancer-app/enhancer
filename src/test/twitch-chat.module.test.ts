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

test("intercepts messages before 7TV suppresses the Twitch handler", () => {
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
		value: {
			querySelector: (selector: string) => (selector === ChatModule.SEVENTV_CHAT_SELECTOR ? {} : null),
		},
	});
	Object.defineProperty(globalThis, "CSS", {
		configurable: true,
		value: { escape: (value: string) => value },
	});

	const message = {
		badges: {},
		id: "message-id",
		nonce: "",
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
	let calls = 0;
	let context: unknown;
	const messageHandlerApi = {
		addMessageHandler: () => {},
		handleMessage(this: unknown, _value: TwitchChatMessage) {
			calls++;
			context = this;
			return "";
		},
	};

	try {
		(chatModule as any).subscribeToSevenTvMessages(messageHandlerApi);
		expect(messageHandlerApi.handleMessage(message)).toBe("");
		(chatModule as any).subscribeToSevenTvMessages(messageHandlerApi);
		expect(messageHandlerApi.handleMessage({ ...message, id: "second-message-id" })).toBe("");

		expect(calls).toBe(2);
		expect(context).toBe(messageHandlerApi);
		expect((chatModule as any).sevenTvMessageQueue.get("message-id").id).toBe("message-id");
		expect((chatModule as any).sevenTvMessageQueue.get("second-message-id").id).toBe("second-message-id");
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
