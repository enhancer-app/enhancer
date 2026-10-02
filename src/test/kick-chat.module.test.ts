import { expect, test } from "bun:test";
import ChatModule from "$kick/modules/chat/chat.module.ts";
import { createKickDependencies, createMessageElement } from "./fakes-b-modules.ts";

test("keeps messages scheduled while processing the current frame", () => {
	const chatModule = new ChatModule(...createKickDependencies());

	const originalRequestAnimationFrame = Object.getOwnPropertyDescriptor(globalThis, "requestAnimationFrame");
	const callbacks: FrameRequestCallback[] = [];
	Object.defineProperty(globalThis, "requestAnimationFrame", {
		configurable: true,
		value: (callback: FrameRequestCallback) => callbacks.push(callback),
	});
	const message = createMessageElement();
	let calls = 0;
	chatModule["handleMessage"] = (element: Element) => {
		calls++;

		if (calls === 1) chatModule["scheduleMessage"](element);
	};

	try {
		chatModule["scheduleMessage"](message);
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
	const chatModule = new ChatModule(...createKickDependencies());
	const element = createMessageElement("true", true);
	chatModule["handleMessage"](element);
	expect(element.getAttribute("enhancer-message-handled")).toBe("true:PENDING");
	element.setAttribute("enhancer-message-handled", "message:id:NTV");
	chatModule["handleMessage"](element);
	expect(element.getAttribute("enhancer-message-handled")).toBe("message:id:PENDING");
});
