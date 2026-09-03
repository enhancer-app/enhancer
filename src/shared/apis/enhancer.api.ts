import { Logger } from "$shared/logger/logger.ts";
import type WorkerService from "$shared/worker/worker.service.ts";
import type {
	EnhancerAccount,
	EnhancerAggregateTopic,
	EnhancerBadge,
	EnhancerChannelDto,
	EnhancerStreamerWatchTimeData,
	XayoWatchtimePeriod,
} from "$types/apis/enhancer.apis.ts";
import type { CommonEvents } from "$types/platforms/common.events.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type {
	CachedAggregateSeed,
	EnhancerApiMessagePayload,
	EnhancerApiUpdatedPayload,
} from "$types/shared/worker/enhancer-api-worker.types.ts";
import type { Emitter } from "nanoevents";

export default class EnhancerApi {
	private currentChannelId = "";
	private desiredChannelId = "";
	private globalSeed: CachedAggregateSeed | null = null;
	private currentSeed: CachedAggregateSeed | null = null;
	private currentTopic: EnhancerAggregateTopic | null = null;
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
		this.worker.onEnhancerApiSeedRequest(this.getSeed);
		this.worker.onRestart(this.handleWorkerRestart);
		window.addEventListener("pagehide", this.disconnect);
		window.addEventListener("pageshow", this.restoreFromBfCache);
	}

	async initialize(): Promise<void> {
		if (this.isInitialized) return;
		const seed = await this.worker.send("initializeEnhancerApi", {
			platform: this.platform,
			clientId: this.clientId,
			...(this.globalSeed ? { seed: this.globalSeed } : {}),
		});
		if (!seed) throw new Error("Enhancer API initialization timed out");
		this.globalSeed = seed;
		this.isInitialized = true;
		this.emitter.emit("extension:enhancer-api-refresh");
		this.logger.debug("Global channel loaded successfully");
	}

	async joinChannel(channelId: string, restoreToken?: number): Promise<boolean> {
		const restoring = restoreToken !== undefined;
		if (!restoring) this.restoreToken++;
		else if (restoreToken !== this.restoreToken) return false;
		if (!channelId || channelId === this.currentChannelId) return false;
		const seed = restoring ? this.currentSeed : null;
		this.desiredChannelId = channelId;
		const generation = ++this.joinGeneration;
		this.currentChannelId = channelId;
		if (!restoring) {
			this.currentSeed = null;
			this.currentTopic = this.getChannelTopic(channelId);
		}
		try {
			const response = await this.worker.send("joinEnhancerChannel", {
				platform: this.platform,
				externalId: channelId,
				clientId: this.clientId,
				...(seed ? { seed } : {}),
			});
			if (!response) throw new Error("Enhancer channel request timed out");
			if (generation !== this.joinGeneration) return false;
			this.currentSeed = response.seed;
			if (response.seed) {
				this.currentTopic = response.seed.topic;
				const externalId = this.getChannelExternalId(response.seed.topic);
				this.currentChannelId = externalId;
				this.desiredChannelId = externalId;
			}
			if (this.currentSeed) this.logger.info(`Successfully joined channel: ${channelId}`);
			else this.logger.info(`Channel ${channelId} not found`);
			return true;
		} catch (error) {
			if (generation === this.joinGeneration) this.currentChannelId = "";
			this.logger.error(`Failed to join channel ${channelId}:`, error);
			throw error;
		}
	}

	getGlobalChannel(): EnhancerChannelDto | null {
		return this.globalSeed?.aggregate ?? null;
	}

	getCurrentChannel(): EnhancerChannelDto | null {
		return this.currentSeed?.aggregate ?? null;
	}

	async getWatchTime(username: string, period: XayoWatchtimePeriod): Promise<EnhancerStreamerWatchTimeData[]> {
		const watchtime = await this.worker.send("getEnhancerWatchTime", { username, period, platform: this.platform });
		if (!watchtime) throw new Error("Enhancer watchtime request timed out");
		return watchtime;
	}

	findUserBadgesForCurrentChannel(externalUserId: string): EnhancerBadge[] {
		const globalAccount = this.globalSeed?.aggregate.accounts.find((account) => account.externalId === externalUserId);
		const channelAccount = this.currentSeed?.aggregate.accounts.find(
			(account) => account.externalId === externalUserId,
		);
		const badgeIds = new Set([...(globalAccount?.badgesIds ?? []), ...(channelAccount?.badgesIds ?? [])]);
		const badges = [...(this.globalSeed?.aggregate.badges ?? []), ...(this.currentSeed?.aggregate.badges ?? [])].filter(
			(badge) => badgeIds.has(badge.badgeId),
		);
		return [...new Map(badges.map((badge) => [badge.badgeId, badge])).values()].sort(
			(left, right) => left.priority - right.priority,
		);
	}

	findUserForCurrentChannel(externalUserId: string): EnhancerAccount | null {
		return (
			this.currentSeed?.aggregate.accounts.find((account) => account.externalId === externalUserId) ??
			this.globalSeed?.aggregate.accounts.find((account) => account.externalId === externalUserId) ??
			null
		);
	}

	private readonly handleUpdate = (payload: EnhancerApiUpdatedPayload): void => {
		if (payload.platform !== this.platform || payload.clientId !== this.clientId) return;
		if (payload.scope === "GLOBAL") {
			this.globalSeed = payload.aggregate
				? { topic: payload.topic, aggregate: payload.aggregate, cursor: payload.cursor }
				: null;
		} else if (payload.topic === this.currentTopic) {
			this.currentSeed = payload.aggregate
				? { topic: payload.replacementTopic ?? payload.topic, aggregate: payload.aggregate, cursor: payload.cursor }
				: null;
			this.currentTopic = payload.replacementTopic ?? payload.topic;
			if (payload.replacementTopic) {
				const externalId = this.getChannelExternalId(payload.replacementTopic);
				this.currentChannelId = externalId;
				this.desiredChannelId = externalId;
			}
		} else {
			return;
		}
		this.emitter.emit("extension:enhancer-api-refresh");
	};

	private readonly handleMessage = (payload: EnhancerApiMessagePayload): void => {
		if (payload.platform !== this.platform || payload.clientId !== this.clientId) return;
		if (payload.message.target.scope === "CHANNEL" && payload.topic !== this.currentTopic) return;
		if (payload.topic === this.globalSeed?.topic) this.globalSeed.cursor = payload.message.cursor;
		if (payload.topic === this.currentSeed?.topic) {
			this.currentSeed.cursor = payload.message.cursor;
		}
		this.emitter.emit("extension:enhancer-api-message", payload.message);
	};

	private readonly getSeed = (topic: EnhancerAggregateTopic): CachedAggregateSeed | null => {
		if (this.globalSeed?.topic === topic) return this.globalSeed;
		if (this.currentSeed?.topic === topic) return this.currentSeed;
		return null;
	};

	private readonly handleWorkerRestart = (): void => {
		const channelId = this.desiredChannelId;
		const restoreToken = ++this.restoreToken;
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

	private readonly disconnect = (): void => {
		void this.worker
			.send("disconnectEnhancerApi", {
				platform: this.platform,
				clientId: this.clientId,
			})
			.catch(() => {});
	};

	private readonly restoreFromBfCache = (event: PageTransitionEvent): void => {
		if (!event.persisted) return;
		const channelId = this.desiredChannelId;
		const restoreToken = ++this.restoreToken;
		this.currentChannelId = "";
		this.isInitialized = false;
		void this.restoreAfterWorkerRestart(channelId, restoreToken);
	};

	private getChannelTopic(externalId: string): EnhancerAggregateTopic {
		return `channel:${this.platform.toUpperCase()}:${externalId}` as EnhancerAggregateTopic;
	}

	private getChannelExternalId(topic: EnhancerAggregateTopic): string {
		return topic.slice(`channel:${this.platform.toUpperCase()}:`.length);
	}
}
