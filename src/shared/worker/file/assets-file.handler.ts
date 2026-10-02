import { MessageHandler } from "$shared/worker/message.handler.ts";
import type { GetAssetsFilePayload, GetAssetsFileResponse } from "$types/shared/worker/worker.types.ts";

export class AssetsFileHandler extends MessageHandler {
	async handle(payload: GetAssetsFilePayload): Promise<GetAssetsFileResponse> {
		if (!payload || !payload.path) {
			throw new Error("Invalid payload for getAssetsFile action. A 'path' string is required.");
		}

		const path = `/assets/${payload.path}`;
		const fileUrl = chrome.runtime.getURL(path);
		this.logger.debug(`Resolved path '${path}' to '${fileUrl}'`);

		return { url: fileUrl };
	}
}
