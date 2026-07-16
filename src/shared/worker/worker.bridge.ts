import type {
	ExtensionMessageDetail,
	ExtensionResponseDetail,
	WorkerBroadcast,
} from "$types/shared/worker/worker.types.ts";

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
						this.setupListeners();
						observer.disconnect();
						return;
					}
				}
			}
		});
		this.bridgeElement = document.querySelector("enhancer-bridge");
		if (this.bridgeElement) {
			this.setupListeners();
		} else {
			observer.observe(document.body, {
				childList: true,
				subtree: true,
			});
		}
	}

	private setupListeners() {
		if (!this.bridgeElement) return;
		this.setupMessageForwarding();
		this.setupBroadcastReceiving();
		this.bridgeElement.dispatchEvent(new CustomEvent("enhancer-bridge-ready"));
		this.log("WorkerService bridge started!");
	}

	private setupMessageForwarding() {
		if (!this.bridgeElement) return;
		this.bridgeElement.addEventListener("enhancer-message", (async (event: CustomEvent<string>) => {
			const detail = JSON.parse(event.detail) as ExtensionMessageDetail;
			const { messageId, action, payload } = detail;
			try {
				const response = await chrome.runtime.sendMessage({
					action,
					payload,
				});
				if (response && typeof response === "object" && "__enhancerWorkerError" in response) {
					throw new Error(response.__enhancerWorkerError as string);
				}
				const responseEvent = new CustomEvent<string>("enhancer-response", {
					detail: JSON.stringify({ messageId, data: response }),
				});
				// biome-ignore lint/style/noNonNullAssertion: we are checking it above, it cannot be null
				this.bridgeElement!.dispatchEvent(responseEvent);
			} catch (error) {
				const errorEvent = new CustomEvent<string>("enhancer-response", {
					detail: JSON.stringify({ messageId, error: (error as Error).message }),
				});
				// biome-ignore lint/style/noNonNullAssertion: we are checking it above, it cannot be null
				this.bridgeElement!.dispatchEvent(errorEvent);
			}
		}) as unknown as EventListener);
	}

	private setupBroadcastReceiving() {
		chrome.runtime.onMessage.addListener((message: WorkerBroadcast) => {
			if (!this.bridgeElement || !message.type) return;
			const broadcastEvent = new CustomEvent<string>("enhancer-broadcast", {
				detail: JSON.stringify(message),
			});
			this.bridgeElement.dispatchEvent(broadcastEvent);
		});
	}

	private log(...data: any[]) {
		console.info("Enhancer worker-bridge", ...data);
	}
}

const bridge = new WorkerBridge();
bridge.start();
