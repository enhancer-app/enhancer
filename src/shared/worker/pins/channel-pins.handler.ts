import type { Logger } from "$shared/logger/logger.ts";
import type { SharedDatabase } from "$shared/worker/database/shared.database.ts";
import type { CrossPlatformFollowsRefresher } from "$shared/worker/cross-platform-follows/cross-platform-follows.refresher.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type {
	ChannelPinsPayload,
	GetChannelPinsPayload,
	SetChannelPinnedPayload,
} from "$types/shared/worker/pins-worker.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { WorkerBroadcast } from "$types/shared/worker/worker.types.ts";

async function readChannelPins(database: SharedDatabase, platform: PlatformType): Promise<ChannelPinsPayload> {
	const pins = await database.getPins(platform);
	return { platform, logins: pins.map((pin) => pin.login) };
}

async function broadcastChannelPins(database: SharedDatabase, platform: PlatformType): Promise<void> {
	const broadcast: WorkerBroadcast = {
		type: "channel-pins-updated",
		payload: await readChannelPins(database, platform),
	};
	chrome.runtime.sendMessage(broadcast).catch(() => {});
	for (const tab of await chrome.tabs.query({})) {
		if (tab.id) chrome.tabs.sendMessage(tab.id, broadcast).catch(() => {});
	}
}

export class GetChannelPinsHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly database: SharedDatabase,
	) {
		super(logger);
	}

	async handle(payload: GetChannelPinsPayload): Promise<ChannelPinsPayload> {
		if (!payload || !["kick", "twitch"].includes(payload.platform)) {
			throw new Error("Invalid payload for getChannelPins action. 'platform' is required.");
		}
		return readChannelPins(this.database, payload.platform);
	}
}

export class SetChannelPinnedHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly database: SharedDatabase,
		private readonly refresher: CrossPlatformFollowsRefresher,
	) {
		super(logger);
	}

	async handle(payload: SetChannelPinnedPayload): Promise<{ success: true }> {
		const login = typeof payload?.login === "string" ? payload.login.trim().toLowerCase() : "";
		if (!payload || !["kick", "twitch"].includes(payload.platform) || !login) {
			throw new Error("Invalid payload for setChannelPinned action. 'platform' and 'login' are required.");
		}

		await this.database.setPins(payload.platform, [login], payload.pinned === true);
		await broadcastChannelPins(this.database, payload.platform);
		await this.refresher.broadcast(payload.platform);
		return { success: true };
	}
}
