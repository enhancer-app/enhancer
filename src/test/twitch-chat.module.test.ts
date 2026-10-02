import { expect, test } from "bun:test";
import ChatModule from "$twitch/modules/chat/chat.module.tsx";
import type { TwitchChatMessage, TwitchEvents } from "$types/platforms/twitch/twitch.events.types.ts";
import type { TestMessageHandlerApi } from "$types/test/fakes-b-chat.types.ts";
import { createNanoEvents } from "nanoevents";
import { createMessageElement, createTwitchDependencies } from "./fakes-b-modules.ts";

const MESSAGE = {
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

function createChatModule(emitter = createNanoEvents<TwitchEvents>()) {
	return new ChatModule(...createTwitchDependencies(emitter));
}

test("finalizes a queued 7TV message id", () => {
	const chatModule = createChatModule();
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

	const message = { ...MESSAGE, id: "", nonce: "message-nonce" };

	// SAFETY: Twitch nonce-link events omit the user and body; buffering only reads their id, nonce, and type.
	const nonceLinkMessage = {
		id: "final-id",
		nonce: message.nonce,
		type: 50,
	} as TwitchChatMessage;

	try {
		chatModule["bufferSevenTvMessage"](message);
		chatModule["bufferSevenTvMessage"](nonceLinkMessage);
		const element = createMessageElement();
		element.setAttribute("msg-id", "final-id");

		expect(chatModule["getSevenTvMessage"](element)?.id).toBe("final-id");
		expect(chatModule["getSevenTvMessage"](element)?.id).toBe("final-id");
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
	const chatModule = createChatModule();
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

	const message = MESSAGE;
	const secondMessage = { ...message, id: "second-message-id" };
	const thirdMessage = { ...message, id: "third-message-id" };
	let calls = 0;
	let context: TestMessageHandlerApi | undefined;
	let receivedMessages: TwitchChatMessage[] = [];

	let originalHandler = function (this: TestMessageHandlerApi, ...messages: TwitchChatMessage[]) {
		calls++;
		context = this;
		receivedMessages = messages;

		return "";
	};

	const messageHandlerApi: TestMessageHandlerApi = {
		addMessageHandler: () => {},
		get handleMessage() {
			return originalHandler;
		},
		set handleMessage(handler: typeof originalHandler) {
			originalHandler = handler;
		},
	};

	const originalDescriptor = Object.getOwnPropertyDescriptor(messageHandlerApi, "handleMessage");

	try {
		chatModule["subscribeToSevenTvMessages"](messageHandlerApi);
		const interceptedDescriptor = Object.getOwnPropertyDescriptor(messageHandlerApi, "handleMessage");
		chatModule["subscribeToSevenTvMessages"](messageHandlerApi);
		expect(Object.getOwnPropertyDescriptor(messageHandlerApi, "handleMessage")?.get).toBe(interceptedDescriptor?.get);
		expect(interceptedDescriptor?.set).toBe(originalDescriptor?.set);
		expect(messageHandlerApi.handleMessage(message, secondMessage)).toBe("");

		expect(calls).toBe(1);
		expect(context).toBe(messageHandlerApi);
		expect(receivedMessages).toEqual([message, secondMessage]);
		expect(chatModule["sevenTvMessageQueue"].get("message-id")?.id).toBe("message-id");
		expect(chatModule["sevenTvMessageQueue"].get("second-message-id")?.id).toBe("second-message-id");

		messageHandlerApi.handleMessage = function (this: TestMessageHandlerApi, ...messages: TwitchChatMessage[]) {
			context = this;
			receivedMessages = messages;

			return "replacement";
		};

		expect(messageHandlerApi.handleMessage(thirdMessage)).toBe("replacement");
		expect(context).toBe(messageHandlerApi);
		expect(receivedMessages).toEqual([thirdMessage]);
		expect(chatModule["sevenTvMessageQueue"].get("third-message-id")?.id).toBe("third-message-id");
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

test("marks a cached 7TV message rerender as replay", () => {
	const replayValues: boolean[] = [];

	const emitter = createNanoEvents<TwitchEvents>();
	emitter.on("twitch:chatMessage", (payload) => {
		replayValues.push(payload.isReplay);
	});
	const chatModule = createChatModule(emitter);

	chatModule["getSevenTvMessage"] = () => MESSAGE;
	chatModule["handleMessage"](createMessageElement(), "7TV", false);
	chatModule["handleMessage"](createMessageElement(), "7TV", false);

	expect(replayValues).toEqual([false, true]);
});
