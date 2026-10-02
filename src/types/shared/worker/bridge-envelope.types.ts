import type { LogEntry } from "$types/shared/logger.types.ts";

export interface BridgeRequestId {
	requestId: string;
}

export interface BridgeLogsResponse extends BridgeRequestId {
	logs?: LogEntry[];
}

export interface BridgeSeedResponse extends BridgeRequestId {
	seed: unknown;
}

export interface EnhancerSubscribeCommand {
	type: "subscribe";
	subscription: import("$types/apis/enhancer.apis.ts").EnhancerSubscription;
	after?: string;
}

export interface BridgeBroadcastEnvelope {
	type: import("$types/shared/worker/worker.types.ts").WorkerBroadcast["type"];
	payload: unknown;
}
