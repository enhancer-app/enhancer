import { Logger } from "$shared/logger/logger.ts";
import type {
	ExtensionMessageDetail,
	ExtensionResponseDetail,
	WorkerAction,
	WorkerApiActions,
	WorkerBroadcast,
} from "$types/shared/worker/worker.types.ts";

export default class WorkerService {
	private readonly logger = new Logger({ context: "worker" });
	private readonly element: HTMLElement;
	private pendingMessages = new Map<string, (response: any) => void>();
	private pingInterval: number | null = null;
	private broadcastHandlers = new Map<string, Set<(payload: any) => void>>();

	constructor() {
		this.element = document.createElement("enhancer-bridge");
		document.body.appendChild(this.element);
	}

	async start() {
		this.setupMessageListener();
		this.setupBroadcastListener();
		await this.waitForBridge();
		this.startPing();
		this.logger.info("WorkerService started");
	}

	private waitForBridge(): Promise<void> {
		return new Promise((resolve) => {
			const handler = () => {
				this.element.removeEventListener("enhancer-bridge-ready", handler);
				resolve();
			};
			this.element.addEventListener("enhancer-bridge-ready", handler);
		});
	}

	stop() {
		if (this.pingInterval) {
			clearInterval(this.pingInterval);
			this.pingInterval = null;
		}
	}

	onBroadcast(type: string, handler: (payload: any) => void): void {
		if (!this.broadcastHandlers.has(type)) {
			this.broadcastHandlers.set(type, new Set());
		}
		this.broadcastHandlers.get(type)?.add(handler);
	}

	offBroadcast(type: string, handler: (payload: any) => void): void {
		this.broadcastHandlers.get(type)?.delete(handler);
	}

	private startPing() {
		this.pingInterval = window.setInterval(async () => {
			try {
				await this.send("ping", undefined);
			} catch (error) {
				this.logger.error("Ping failed:", error);
			}
		}, 5000);
	}

	private setupMessageListener() {
		this.element.addEventListener("enhancer-response", ((event: CustomEvent<string>) => {
			const detail = JSON.parse(event.detail) as ExtensionResponseDetail;
			const { messageId, data, error } = detail;
			const resolver = this.pendingMessages.get(messageId);
			if (resolver) {
				this.pendingMessages.delete(messageId);
				if (error) {
					throw new Error(error);
				}
				resolver(data);
			}
		}) as unknown as EventListener);
	}

	private setupBroadcastListener() {
		this.element.addEventListener("enhancer-broadcast", ((event: CustomEvent<string>) => {
			try {
				const broadcast = JSON.parse(event.detail) as WorkerBroadcast;
				const handlers = this.broadcastHandlers.get(broadcast.type);
				if (handlers) {
					for (const handler of handlers) {
						handler(broadcast.payload);
					}
				}
			} catch (error) {
				this.logger.error("Failed to parse broadcast:", error);
			}
		}) as EventListener);
	}

	async send<T extends WorkerAction>(
		action: T,
		...args: WorkerApiActions[T]["payload"] extends never ? [] : [WorkerApiActions[T]["payload"]]
	): Promise<WorkerApiActions[T]["response"] | null> {
		return new Promise((resolve) => {
			const messageId = crypto.randomUUID();
			this.pendingMessages.set(messageId, resolve);

			const payload = args.length > 0 ? args[0] : undefined;
			const event = new CustomEvent<string>("enhancer-message", {
				detail: JSON.stringify({ messageId, action, payload }),
			});

			this.element.dispatchEvent(event);

			setTimeout(() => {
				if (this.pendingMessages.has(messageId)) {
					this.pendingMessages.delete(messageId);
					resolve(null);
				}
			}, 10000);
		});
	}
}
