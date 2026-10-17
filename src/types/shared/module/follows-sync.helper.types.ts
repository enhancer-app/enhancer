import type { FollowedChannel } from "$types/shared/worker/cross-platform-follows-worker.types.ts";

export type FollowsSyncCollection = {
	channels: FollowedChannel[];
};

export type FollowsSyncHelperOptions = {
	isEnabled: () => boolean;
	beforeSync?: () => Promise<void>;
	collect?: {
		maxAgeMs: number;
		run: () => Promise<FollowsSyncCollection | null>;
	};
};
