import { expect, test } from "bun:test";
import ChatModule from "$kick/modules/chat/chat.module.ts";

test("keeps messages scheduled while processing the current frame", () => {
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
	const originalRequestAnimationFrame = Object.getOwnPropertyDescriptor(globalThis, "requestAnimationFrame");
	const callbacks: FrameRequestCallback[] = [];
	Object.defineProperty(globalThis, "requestAnimationFrame", {
		configurable: true,
		value: (callback: FrameRequestCallback) => callbacks.push(callback),
	});
	const message = {} as Element;
	let calls = 0;
	(chatModule as any).handleMessage = (element: Element) => {
		calls++;
		if (calls === 1) (chatModule as any).scheduleMessage(element);
	};

	try {
		(chatModule as any).scheduleMessage(message);
		callbacks.shift()?.(0);
		expect(calls).toBe(1);
		callbacks.shift()?.(0);
		expect(calls).toBe(2);
	} finally {
		if (originalRequestAnimationFrame) {
			Object.defineProperty(globalThis, "requestAnimationFrame", originalRequestAnimationFrame);
		} else {
			Reflect.deleteProperty(globalThis, "requestAnimationFrame");
		}
	}
});

test("preserves legacy and colon-containing message markers while pending", () => {
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
	let marker = "true";
	const element = {
		isConnected: true,
		classList: { contains: () => true },
		getAttribute: () => marker,
		setAttribute: (_name: string, value: string) => {
			marker = value;
		},
	} as unknown as Element;

	(chatModule as any).handleMessage(element);
	expect(marker).toBe("true:PENDING");
	marker = "message:id:NTV";
	(chatModule as any).handleMessage(element);
	expect(marker).toBe("message:id:PENDING");
});
