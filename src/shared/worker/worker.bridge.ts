import type { LogEntry } from "$types/shared/logger.types.ts";
import type {
	ExtensionMessageDetail,
	ExtensionResponseDetail,
	WorkerBroadcast,
} from "$types/shared/worker/worker.types.ts";

class BridgeLogger {
	private static readonly MAX_ENTRIES = 500;
	private static readonly MAX_DATA_LENGTH = 2000;
	private static readonly MAX_ENTRY_LENGTH = 8192;
	private static readonly SENSITIVE_KEY = /authorization|cookie|token|password|secret|api[_-]?key|credential/i;
	private static readonly SENSITIVE_HEADER = /((?:authorization|cookie|set-cookie)\s*:\s*)[^\r\n]*/gi;
	private static readonly SENSITIVE_TEXT =
		/(["']?(?:authorization|cookie|set-cookie|token|password|secret|api[_-]?key|credential)["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^,;}\s]*)/gi;
	private static readonly SENSITIVE_QUERY =
		/([?&](?:authorization|cookie|token|access_token|refresh_token|password|secret|api[_-]?key|credential)=)[^&#\s]*/gi;
	private static readonly BEARER_TOKEN = /\bBearer\s+[^\s,;}]+/gi;
	private static entries: LogEntry[] = [];

	constructor(private readonly context: string) {}

	info(...data: unknown[]): void {
		this.add("info", data);
	}

	error(...data: unknown[]): void {
		this.add("error", data);
	}

	static getLogs(): LogEntry[] {
		return BridgeLogger.entries.map((entry) => ({ ...entry, data: [...entry.data] }));
	}

	private add(level: LogEntry["level"], data: unknown[]): void {
		const normalizedData: string[] = [];
		let entryLength = 0;
		for (const value of data) {
			const serialized = this.serialize(value);
			const remaining = BridgeLogger.MAX_ENTRY_LENGTH - entryLength;
			if (serialized.length > remaining) {
				const suffix = "...[TRUNCATED]";
				if (remaining > suffix.length) {
					normalizedData.push(`${serialized.slice(0, remaining - suffix.length)}${suffix}`);
				} else if (remaining > 0) {
					normalizedData.push(suffix.slice(0, remaining));
				}
				break;
			}
			normalizedData.push(serialized);
			entryLength += serialized.length;
		}
		BridgeLogger.entries.push({
			timestamp: Date.now(),
			level,
			context: this.context,
			source: "bridge",
			data: normalizedData,
		});
		if (BridgeLogger.entries.length > BridgeLogger.MAX_ENTRIES) BridgeLogger.entries.shift();
		console[level](`Enhancer worker-bridge ${level.toUpperCase()}`, ...normalizedData);
	}

	private serialize(value: unknown): string {
		if (value instanceof Error)
			return this.sanitize(`${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ""}`);
		if (typeof value === "string") return this.sanitize(value);
		if (value === undefined) return "undefined";
		if (value === null) return "null";
		if (typeof value !== "object") return this.sanitize(String(value));

		const seen = new WeakSet<object>();
		try {
			const serialized = JSON.stringify(value, (key, nestedValue) => {
				if (BridgeLogger.SENSITIVE_KEY.test(key)) return "[REDACTED]";
				if (nestedValue instanceof Error) {
					return { name: nestedValue.name, message: nestedValue.message, stack: nestedValue.stack };
				}
				if (nestedValue && typeof nestedValue === "object") {
					if (seen.has(nestedValue)) return "[Circular]";
					seen.add(nestedValue);
				}
				return nestedValue;
			});
			return this.sanitize(serialized ?? String(value));
		} catch {
			return this.sanitize(String(value));
		}
	}

	private sanitize(value: string): string {
		return value
			.replace(BridgeLogger.SENSITIVE_HEADER, "$1[REDACTED]")
			.replace(BridgeLogger.BEARER_TOKEN, "Bearer [REDACTED]")
			.replace(BridgeLogger.SENSITIVE_TEXT, "$1[REDACTED]")
			.replace(BridgeLogger.SENSITIVE_QUERY, "$1[REDACTED]")
			.slice(0, BridgeLogger.MAX_DATA_LENGTH);
	}
}

export default class WorkerBridge {
	private readonly logger = new BridgeLogger("worker-bridge");
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
					detail: JSON.stringify({ requestId, logs: BridgeLogger.getLogs() satisfies LogEntry[] }),
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
