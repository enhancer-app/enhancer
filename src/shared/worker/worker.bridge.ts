import { Logger } from "$shared/logger/logger.ts";
import type { LogEntry } from "$types/shared/logger.types.ts";
import type {
	ExtensionMessageDetail,
	ExtensionResponseDetail,
	WorkerBroadcast,
} from "$types/shared/worker/worker.types.ts";

export default class WorkerBridge {
	private readonly logger = new Logger({ context: "worker-bridge", source: "bridge" });
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
		this.setupLogRetrieval();
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
		chrome.runtime.onMessage.addListener((message: WorkerBroadcast, _sender, sendResponse) => {
			if (!this.bridgeElement || !message.type) return;
			if (message.type === "enhancer-api-seed-request") {
				const requestId = message.payload.requestId;
				const handleResponse = (event: Event) => {
					const detail = JSON.parse((event as CustomEvent<string>).detail) as {
						requestId: string;
						seed: unknown;
					};
					if (detail.requestId !== requestId) return;
					clearTimeout(timeout);
					this.bridgeElement?.removeEventListener("enhancer-api-seed-response", handleResponse);
					sendResponse(detail.seed);
				};
				const timeout = setTimeout(() => {
					this.bridgeElement?.removeEventListener("enhancer-api-seed-response", handleResponse);
					sendResponse(null);
				}, 2000);
				this.bridgeElement.addEventListener("enhancer-api-seed-response", handleResponse);
				this.bridgeElement.dispatchEvent(
					new CustomEvent<string>("enhancer-api-seed-request", { detail: JSON.stringify(message.payload) }),
				);
				return true;
			}
			const broadcastEvent = new CustomEvent<string>("enhancer-broadcast", {
				detail: JSON.stringify(message),
			});
			this.bridgeElement.dispatchEvent(broadcastEvent);
		});
	}

	private setupLogRetrieval() {
		if (!this.bridgeElement) return;
		this.bridgeElement.addEventListener("enhancer-bridge-logs-request", ((event: CustomEvent<string>) => {
			try {
				const { requestId } = JSON.parse(event.detail) as { requestId: string };
				const response = new CustomEvent<string>("enhancer-bridge-logs-response", {
					detail: JSON.stringify({ requestId, logs: Logger.getLogs() satisfies LogEntry[] }),
				});
				this.bridgeElement?.dispatchEvent(response);
			} catch (error) {
				this.logger.error("Failed to provide bridge logs:", error);
			}
		}) as unknown as EventListener);
	}

	private log(...data: any[]) {
		this.logger.info(...data);
	}
}

const bridge = new WorkerBridge();
bridge.start();
