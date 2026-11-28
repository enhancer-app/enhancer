import { resolvePlaybackUrl } from "$shared/utils/stream-preview.utils.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { GetStreamPlaybackUrlPayload } from "$types/shared/worker/cross-platform-follows-worker.types.ts";

export class GetStreamPlaybackUrlHandler extends MessageHandler {
	async handle(payload: GetStreamPlaybackUrlPayload): Promise<{ url: string | null }> {
		const login = typeof payload?.login === "string" ? payload.login.trim().toLowerCase() : "";
		if (!payload || !["kick", "twitch"].includes(payload.platform) || !/^[\w-]+$/.test(login)) {
			throw new Error("Invalid payload for getStreamPlaybackUrl action. 'platform' and 'login' are required.");
		}

		return { url: await resolvePlaybackUrl(payload.platform, login) };
	}
}
