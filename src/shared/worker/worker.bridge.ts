import type { ExtensionMessageDetail, ExtensionResponseDetail } from "$types/shared/worker/worker.types.ts";

export default class WorkerBridge {
	private bridgeElement: HTMLElement | null = null;

	start() {
		this.waitForBridgeElement();
		this.log("WorkerService bridge starting...");
	}

	private waitForBridgeElement() {
		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				for (const node of mutation.addedNodes) {
					if (node instanceof HTMLElement && node.tagName === "ENHANCER-BRIDGE") {
						this.bridgeElement = node;
						this.setupMessageListener();
						observer.disconnect();
						return;
					}
				}
			}
		});
		this.bridgeElement = document.querySelector("enhancer-bridge");
		if (this.bridgeElement) {
			this.setupMessageListener();
		} else {
			observer.observe(document.body, {
				childList: true,
				subtree: true,
			});
		}
	}

	private setupMessageListener() {
		if (!this.bridgeElement) return;
		this.log("WorkerService bridge started!");
		this.bridgeElement.addEventListener("enhancer-message", (async (event: CustomEvent<string>) => {
			//ExtensionMessageDetail
			const detail = JSON.parse(event.detail) as ExtensionMessageDetail;
			const { messageId, action, payload } = detail;
			try {
				const response = await chrome.runtime.sendMessage({
					action,
					payload,
				});
				const responseEvent = new CustomEvent<string>("enhancer-response", {
					// ExtensionResponseDetail
					detail: JSON.stringify({ messageId, data: response }),
				});
				// biome-ignore lint/style/noNonNullAssertion: we are checking it above, it cannot be null
				this.bridgeElement!.dispatchEvent(responseEvent);
			} catch (error) {
				// ExtensionResponseDetail
				const errorEvent = new CustomEvent<string>("enhancer-response", {
					detail: JSON.stringify({ messageId, error: (error as Error).message }),
				});
				// biome-ignore lint/style/noNonNullAssertion: we are checking it above, it cannot be null
				this.bridgeElement!.dispatchEvent(errorEvent);
			}
		}) as unknown as EventListener);

		// Listen for messages FROM background worker TO content script
		chrome.runtime.onMessage.addListener((message) => {
			// Relay background messages to page context via custom event on bridge element
			if (this.bridgeElement && message.action) {
				const bgEvent = new CustomEvent<string>("enhancer-background-message", {
					detail: JSON.stringify(message),
				});
				this.bridgeElement.dispatchEvent(bgEvent);
			}
		});
	}

	private log(...data: any[]) {
		console.info("Enhancer worker-bridge", ...data);
	}
}

const bridge = new WorkerBridge();
bridge.start();
