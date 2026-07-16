import { Logger } from "$shared/logger/logger.ts";
import type WorkerService from "$shared/worker/worker.service.ts";
import type {
	EnhancerAccount,
	EnhancerBadge,
	EnhancerChannelDto,
	EnhancerStreamerWatchTimeData,
} from "$types/apis/enhancer.apis.ts";
import type { CommonEvents } from "$types/platforms/common.events.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type {
	EnhancerApiMessagePayload,
	EnhancerApiUpdatedPayload,
} from "$types/shared/worker/enhancer-api-worker.types.ts";
import type { Emitter } from "nanoevents";

export default class EnhancerApi {
	private currentChannelId = "";
	private desiredChannelId = "";
	private globalChannel: EnhancerChannelDto | null = null;
	private currentChannel: EnhancerChannelDto | null = null;
	private isInitialized = false;
	private joinGeneration = 0;
	private restoreToken = 0;
	private readonly clientId = crypto.randomUUID();
	private readonly logger = new Logger({ context: "enhancer-api" });

	constructor(
		private readonly platform: PlatformType,
		private readonly worker: WorkerService,
		private readonly emitter: Emitter<CommonEvents>,
	) {
		this.worker.onBroadcast("enhancer-api-updated", this.handleUpdate);
		this.worker.onBroadcast("enhancer-api-message", this.handleMessage);
		this.worker.onRestart(this.handleWorkerRestart);
		window.addEventListener("pagehide", this.disconnect);
		window.addEventListener("pageshow", this.restoreFromBfCache);
	}

	async initialize(): Promise<void> {
		if (this.isInitialized) return;
		const aggregate = await this.worker.send("initializeEnhancerApi", {
			platform: this.platform,
			clientId: this.clientId,
		});
		if (!aggregate) throw new Error("Enhancer API initialization timed out");
		this.globalChannel = aggregate;
		this.isInitialized = true;
		this.emitter.emit("extension:enhancer-api-refresh");
		this.logger.debug("Global channel loaded successfully");
	}

	async joinChannel(channelId: string, restoreToken?: number): Promise<boolean> {
		if (restoreToken === undefined) this.restoreToken++;
		else if (restoreToken !== this.restoreToken) return false;
		if (!channelId || channelId === this.currentChannelId) return false;
		this.desiredChannelId = channelId;
		const generation = ++this.joinGeneration;
		this.currentChannelId = channelId;
		this.currentChannel = null;
		try {
			const response = await this.worker.send("joinEnhancerChannel", {
				platform: this.platform,
				externalId: channelId,
				clientId: this.clientId,
			});
			if (!response) throw new Error("Enhancer channel request timed out");
			if (generation !== this.joinGeneration) return false;
			this.currentChannel = response.aggregate;
			if (this.currentChannel) this.logger.info(`Successfully joined channel: ${channelId}`);
			else this.logger.info(`Channel ${channelId} not found`);
			return true;
		} catch (error) {
			if (generation === this.joinGeneration) this.currentChannelId = "";
			this.logger.error(`Failed to join channel ${channelId}:`, error);
			throw error;
		}
	}

	getGlobalChannel(): EnhancerChannelDto | null {
		return this.globalChannel;
	}

	getCurrentChannel(): EnhancerChannelDto | null {
		return this.currentChannel;
	}

	async getWatchTime(username: string): Promise<EnhancerStreamerWatchTimeData[]> {
		const watchtime = await this.worker.send("getEnhancerWatchTime", { username });
		if (!watchtime) throw new Error("Enhancer watchtime request timed out");
		return watchtime;
	}

	findUserBadgesForCurrentChannel(externalUserId: string): EnhancerBadge[] {
		const globalAccount = this.globalChannel?.accounts.find((account) => account.externalId === externalUserId);
		const channelAccount = this.currentChannel?.accounts.find((account) => account.externalId === externalUserId);
		const badgeIds = new Set([...(globalAccount?.badgesIds ?? []), ...(channelAccount?.badgesIds ?? [])]);
		const badges = [...(this.globalChannel?.badges ?? []), ...(this.currentChannel?.badges ?? [])].filter((badge) =>
			badgeIds.has(badge.badgeId),
		);
		return [...new Map(badges.map((badge) => [badge.badgeId, badge])).values()].sort(
			(left, right) => left.priority - right.priority,
		);
	}

	findUserForCurrentChannel(externalUserId: string): EnhancerAccount | null {
		return (
			this.currentChannel?.accounts.find((account) => account.externalId === externalUserId) ??
			this.globalChannel?.accounts.find((account) => account.externalId === externalUserId) ??
			null
		);
	}

	private readonly handleUpdate = (payload: EnhancerApiUpdatedPayload): void => {
		if (payload.platform !== this.platform || payload.clientId !== this.clientId) return;
		if (payload.scope === "GLOBAL") {
			this.globalChannel = payload.aggregate;
		} else if (payload.externalId === this.currentChannelId) {
			this.currentChannel = payload.aggregate;
		} else {
			return;
		}
		this.emitter.emit("extension:enhancer-api-refresh");
	};

	private readonly handleMessage = (payload: EnhancerApiMessagePayload): void => {
		if (payload.platform !== this.platform || payload.clientId !== this.clientId) return;
		this.emitter.emit("extension:enhancer-api-message", payload.message);
	};

	private readonly handleWorkerRestart = (): void => {
		const channelId = this.desiredChannelId;
		const restoreToken = ++this.restoreToken;
		this.globalChannel = null;
		this.currentChannel = null;
		this.currentChannelId = "";
		this.isInitialized = false;
		void this.restoreAfterWorkerRestart(channelId, restoreToken);
	};

	private async restoreAfterWorkerRestart(channelId: string, restoreToken: number, attempt = 1): Promise<void> {
		if (restoreToken !== this.restoreToken) return;
		try {
			await this.initialize();
			if (restoreToken !== this.restoreToken) return;
			if (channelId) await this.joinChannel(channelId, restoreToken);
		} catch (error) {
			this.logger.error(`Enhancer API restore attempt ${attempt} failed:`, error);
			if (attempt < 5) {
				setTimeout(() => void this.restoreAfterWorkerRestart(channelId, restoreToken, attempt + 1), 5000);
			}
		}
	}

	private readonly disconnect = (event: PageTransitionEvent): void => {
		if (event.persisted) return;
		void this.worker
			.send("disconnectEnhancerApi", { platform: this.platform, clientId: this.clientId })
			.catch(() => {});
	};

	private readonly restoreFromBfCache = (event: PageTransitionEvent): void => {
		if (!event.persisted) return;
		const channelId = this.desiredChannelId;
		const restoreToken = ++this.restoreToken;
		this.globalChannel = null;
		this.currentChannel = null;
		this.currentChannelId = "";
		this.isInitialized = false;
		void this.restoreAfterWorkerRestart(channelId, restoreToken);
	};
}
