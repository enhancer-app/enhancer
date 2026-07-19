import { expect, test } from "bun:test";
import ChatModule from "$twitch/modules/chat/chat.module.tsx";
import type { TwitchChatMessage } from "$types/platforms/twitch/twitch.events.types.ts";

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

function createChatModule(emitter: ConstructorParameters<typeof ChatModule>[0] = {} as never) {
	return new ChatModule(
		emitter,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
	);
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

	try {
		(chatModule as any).bufferSevenTvMessage(message);
		(chatModule as any).bufferSevenTvMessage({ ...message, id: "final-id", type: 51 });
		const element = { getAttribute: () => "final-id" } as unknown as Element;

		expect((chatModule as any).getSevenTvMessage(element).id).toBe("final-id");
		expect((chatModule as any).getSevenTvMessage(element).id).toBe("final-id");
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
	let context: unknown;
	let receivedMessages: TwitchChatMessage[] = [];
	let originalHandler = function (this: unknown, ...messages: TwitchChatMessage[]) {
		calls++;
		context = this;
		receivedMessages = messages;
		return "";
	};
	const messageHandlerApi = {
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
		(chatModule as any).subscribeToSevenTvMessages(messageHandlerApi);
		const interceptedDescriptor = Object.getOwnPropertyDescriptor(messageHandlerApi, "handleMessage");
		(chatModule as any).subscribeToSevenTvMessages(messageHandlerApi);
		expect(Object.getOwnPropertyDescriptor(messageHandlerApi, "handleMessage")?.get).toBe(interceptedDescriptor?.get);
		expect(interceptedDescriptor?.set).toBe(originalDescriptor?.set);
		expect(messageHandlerApi.handleMessage(message, secondMessage)).toBe("");

		expect(calls).toBe(1);
		expect(context).toBe(messageHandlerApi);
		expect(receivedMessages).toEqual([message, secondMessage]);
		expect((chatModule as any).sevenTvMessageQueue.get("message-id").id).toBe("message-id");
		expect((chatModule as any).sevenTvMessageQueue.get("second-message-id").id).toBe("second-message-id");

		messageHandlerApi.handleMessage = function (this: unknown, ...messages: TwitchChatMessage[]) {
			context = this;
			receivedMessages = messages;
			return "replacement";
		};
		expect(messageHandlerApi.handleMessage(thirdMessage)).toBe("replacement");
		expect(context).toBe(messageHandlerApi);
		expect(receivedMessages).toEqual([thirdMessage]);
		expect((chatModule as any).sevenTvMessageQueue.get("third-message-id").id).toBe("third-message-id");
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
	const chatModule = createChatModule({
		emit: (_event: string, payload: { isReplay: boolean }) => replayValues.push(payload.isReplay),
	} as never);
	(chatModule as any).getSevenTvMessage = () => MESSAGE;
	const createElement = () => {
		let marker: string | null = null;
		return {
			getAttribute: () => marker,
			setAttribute: (_name: string, value: string) => {
				marker = value;
			},
		} as unknown as Element;
	};

	(chatModule as any).handleMessage(createElement(), "7TV", false);
	(chatModule as any).handleMessage(createElement(), "7TV", false);

	expect(replayValues).toEqual([false, true]);
});
