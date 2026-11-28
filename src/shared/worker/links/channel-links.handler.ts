import type { Logger } from "$shared/logger/logger.ts";
import { getChannelLinkId, getConflictingLinkIds } from "$shared/utils/follows-links.utils.ts";
import type { SharedDatabase } from "$shared/worker/database/shared.database.ts";
import { MessageHandler } from "$shared/worker/message.handler.ts";
import type {
	ChannelLinkRecord,
	ChannelLinksPayload,
	RemoveChannelLinkPayload,
	UpdateChannelLinkPayload,
} from "$types/shared/worker/channel-links-worker.types.ts";
import type { WorkerBroadcast } from "$types/shared/worker/worker.types.ts";

async function readChannelLinks(database: SharedDatabase): Promise<ChannelLinksPayload> {
	const records = await database.getLinks();
	return {
		links: records.map(({ twitch, kick, primary }) => ({
			twitch,
			kick,
			primary: primary === "kick" ? "kick" : "twitch",
		})),
	};
}

async function broadcastChannelLinks(database: SharedDatabase): Promise<ChannelLinksPayload> {
	const links = await readChannelLinks(database);
	const broadcast: WorkerBroadcast = { type: "channel-links-updated", payload: links };
	chrome.runtime.sendMessage(broadcast).catch(() => {});
	for (const tab of await chrome.tabs.query({})) {
		if (tab.id) chrome.tabs.sendMessage(tab.id, broadcast).catch(() => {});
	}
	return links;
}

function readLogins(payload: RemoveChannelLinkPayload | undefined, action: string) {
	const twitch = typeof payload?.twitch === "string" ? payload.twitch.trim().toLowerCase() : "";
	const kick = typeof payload?.kick === "string" ? payload.kick.trim().toLowerCase() : "";
	if (!twitch || !kick) {
		throw new Error(`Invalid payload for ${action} action. 'twitch' and 'kick' logins are required.`);
	}
	return { twitch, kick };
}

export class GetChannelLinksHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly database: SharedDatabase,
	) {
		super(logger);
	}

	async handle(): Promise<ChannelLinksPayload> {
		return readChannelLinks(this.database);
	}
}

export class UpdateChannelLinkHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly database: SharedDatabase,
	) {
		super(logger);
	}

	async handle(payload: UpdateChannelLinkPayload): Promise<ChannelLinksPayload> {
		const { twitch, kick } = readLogins(payload, "updateChannelLink");
		if (payload.primary !== "twitch" && payload.primary !== "kick") {
			throw new Error("Invalid payload for updateChannelLink action. 'primary' must be 'twitch' or 'kick'.");
		}

		const record: ChannelLinkRecord = {
			id: getChannelLinkId(twitch, kick),
			twitch,
			kick,
			primary: payload.primary,
			updatedAt: Date.now(),
		};
		await this.database.putLink(record, getConflictingLinkIds(await this.database.getLinks(), record));
		return broadcastChannelLinks(this.database);
	}
}

export class RemoveChannelLinkHandler extends MessageHandler {
	constructor(
		logger: Logger,
		private readonly database: SharedDatabase,
	) {
		super(logger);
	}

	async handle(payload: RemoveChannelLinkPayload): Promise<ChannelLinksPayload> {
		const { twitch, kick } = readLogins(payload, "removeChannelLink");
		await this.database.deleteLink(getChannelLinkId(twitch, kick));
		return broadcastChannelLinks(this.database);
	}
}
