import type { EnhancerAccountBroadcastPayload } from "$types/shared/worker/enhancer-account-worker.types.ts";
import type { WorkerAction, WorkerApiActions } from "$types/shared/worker/worker.types.ts";

export interface WorkerClient {
	send<T extends WorkerAction>(
		action: T,
		...args: WorkerApiActions[T]["payload"] extends never ? [] : [WorkerApiActions[T]["payload"]]
	): Promise<WorkerApiActions[T]["response"] | null>;
	onBroadcast(type: "enhancer-account-updated", handler: (payload: EnhancerAccountBroadcastPayload) => void): void;
}
