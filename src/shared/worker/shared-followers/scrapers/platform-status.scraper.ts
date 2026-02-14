import type { PlatformType } from "$types/shared/platform.types.ts";
import type { StreamStatusResult } from "$types/shared/worker/shared-storage.types.ts";

export interface PlatformStatusScraper {
	readonly platform: PlatformType;

	/** Maximum number of channels that can be checked in a single API call. */
	readonly maxBatchSize: number;

	/**
	 * Checks the current stream status for a batch of channels.
	 *
	 * @param channelLogins - The channel identifiers to check (e.g., slugs for Kick, logins for Twitch).
	 * @returns A map of channelId → StreamStatusResult for each channel in the batch.
	 */
	checkStatusBatch(channelLogins: string[]): Promise<Map<string, StreamStatusResult>>;
}
