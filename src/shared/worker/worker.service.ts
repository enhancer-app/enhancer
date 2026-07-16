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
	private pendingMessages = new Map<string, { resolve: (response: any) => void; reject: (error: Error) => void }>();
	private pingInterval: number | null = null;
	private broadcastHandlers = new Map<string, Set<(payload: any) => void>>();
	private restartHandlers = new Set<() => void>();
	private workerInstanceId: string | null = null;

	constructor() {
		this.element = document.createElement("enhancer-bridge");
		document.body.appendChild(this.element);
	}

	async start() {
		this.setupMessageListener();
		this.setupBroadcastListener();
		await this.waitForBridge();
		await this.ping();
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

	onBroadcast<T extends WorkerBroadcast["type"]>(
		type: T,
		handler: (payload: Extract<WorkerBroadcast, { type: T }>["payload"]) => void,
	): void {
		if (!this.broadcastHandlers.has(type)) {
			this.broadcastHandlers.set(type, new Set());
		}
		this.broadcastHandlers.get(type)?.add(handler);
	}

	offBroadcast<T extends WorkerBroadcast["type"]>(
		type: T,
		handler: (payload: Extract<WorkerBroadcast, { type: T }>["payload"]) => void,
	): void {
		this.broadcastHandlers.get(type)?.delete(handler);
	}

	onRestart(handler: () => void): void {
		this.restartHandlers.add(handler);
	}

	private startPing() {
		this.pingInterval = window.setInterval(() => void this.ping(), 5000);
	}

	private async ping(): Promise<void> {
		try {
			const response = await this.send("ping", undefined);
			if (!response) return;
			if (this.workerInstanceId && this.workerInstanceId !== response.instanceId) {
				for (const handler of this.restartHandlers) handler();
			}
			this.workerInstanceId = response.instanceId;
		} catch (error) {
			this.logger.error("Ping failed:", error);
		}
	}

	private setupMessageListener() {
		this.element.addEventListener("enhancer-response", ((event: CustomEvent<string>) => {
			const detail = JSON.parse(event.detail) as ExtensionResponseDetail;
			const { messageId, data, error } = detail;
			const pending = this.pendingMessages.get(messageId);
			if (pending) {
				this.pendingMessages.delete(messageId);
				if (error) {
					pending.reject(new Error(error));
					return;
				}
				pending.resolve(data);
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
		return new Promise((resolve, reject) => {
			const messageId = crypto.randomUUID();
			this.pendingMessages.set(messageId, { resolve, reject });

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
