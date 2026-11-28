import type { ChannelLinksPayload } from "$types/shared/worker/channel-links-worker.types.ts";
import type { WorkerApiActions } from "$types/shared/worker/worker.types.ts";

export type ChannelLinksAction = "getChannelLinks" | "updateChannelLink" | "removeChannelLink";

export type ChannelLinksTransport = {
	send: <K extends ChannelLinksAction>(
		action: K,
		payload: WorkerApiActions[K]["payload"],
	) => Promise<ChannelLinksPayload | null>;
	subscribe: (handler: (payload: ChannelLinksPayload) => void) => () => void;
};
