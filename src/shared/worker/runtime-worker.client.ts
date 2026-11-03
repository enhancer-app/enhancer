import type { EnhancerAccountBroadcastPayload } from "$types/shared/worker/enhancer-account-worker.types.ts";
import type { WorkerClient } from "$types/shared/worker/worker-client.types.ts";
import type { WorkerAction, WorkerApiActions, WorkerBroadcast } from "$types/shared/worker/worker.types.ts";

export class RuntimeWorkerClient implements WorkerClient {
	async send<T extends WorkerAction>(
		action: T,
		...args: WorkerApiActions[T]["payload"] extends never ? [] : [WorkerApiActions[T]["payload"]]
	): Promise<WorkerApiActions[T]["response"] | null> {
		const response = await chrome.runtime.sendMessage({ action, payload: args[0] });
		if (response && typeof response === "object" && "__enhancerWorkerError" in response) {
			throw new Error(String(response.__enhancerWorkerError));
		}
		return response ?? null;
	}

	onBroadcast(type: "enhancer-account-updated", handler: (payload: EnhancerAccountBroadcastPayload) => void): void {
		chrome.runtime.onMessage.addListener((message: WorkerBroadcast) => {
			if (message?.type === type) handler(message.payload);
		});
	}
}
