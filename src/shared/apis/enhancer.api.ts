import { decodeBase64, EnhancerAggregateView } from "$shared/apis/enhancer-snapshot.ts";
import { Logger } from "$shared/logger/logger.ts";
import type WorkerService from "$shared/worker/worker.service.ts";
import type {
	EnhancerAccount,
	EnhancerAggregateTopic,
	EnhancerBadge,
	EnhancerStreamerWatchTimeData,
	XayoWatchtimePeriod,
} from "$types/apis/enhancer.apis.ts";
import type { CommonEvents } from "$types/platforms/common.events.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type {
	AggregateScope,
	AggregateSeed,
	EnhancerApiMessagePayload,
	EnhancerApiPatchPayload,
	EnhancerApiUpdatedPayload,
} from "$types/shared/worker/enhancer-api-worker.types.ts";
import type { Emitter } from "nanoevents";

export default class EnhancerApi {
	private static readonly MAX_PENDING_PATCHES = 1000;

	private currentChannelId = "";
	private desiredChannelId = "";
	private globalView: EnhancerAggregateView | null = null;
	private currentView: EnhancerAggregateView | null = null;
	private globalTopic: EnhancerAggregateTopic;
	private currentTopic: EnhancerAggregateTopic | null = null;
	private readonly pendingPatches = new Map<EnhancerAggregateTopic, EnhancerApiPatchPayload[]>();
	private readonly resyncing = new Set<AggregateScope>();
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
		this.globalTopic = `global:${platform.toUpperCase()}` as EnhancerAggregateTopic;
		this.worker.onBroadcast("enhancer-api-updated", this.handleUpdate);
		this.worker.onBroadcast("enhancer-api-patch", this.handlePatch);
		this.worker.onBroadcast("enhancer-api-message", this.handleMessage);
		this.worker.onRestart(this.handleWorkerRestart);
		window.addEventListener("pagehide", this.disconnect);
		window.addEventListener("pageshow", this.restoreFromBfCache);
	}

	async initialize(): Promise<void> {
		if (this.isInitialized) return;
		await this.loadGlobal();
		this.isInitialized = true;
		this.logger.debug("Global channel loaded successfully");
	}

	async joinChannel(channelId: string, restoreToken?: number): Promise<boolean> {
		const restoring = restoreToken !== undefined;
		if (!restoring) this.restoreToken++;
		else if (restoreToken !== this.restoreToken) return false;
		if (!channelId || channelId === this.currentChannelId) return false;
		this.desiredChannelId = channelId;
		const generation = ++this.joinGeneration;
		this.currentChannelId = channelId;
		if (!restoring) {
			this.currentView = null;
			this.currentTopic = this.getChannelTopic(channelId);
		}
		try {
			const response = await this.requestChannel(channelId, generation, restoring ? this.currentView?.hash : undefined);
			if (generation !== this.joinGeneration) return false;
			if (response.seed) {
				const externalId = this.getChannelExternalId(response.seed.topic);
				this.currentChannelId = externalId;
				this.desiredChannelId = externalId;
				this.logger.info(`Successfully joined channel: ${channelId}`);
			} else {
				this.currentView = null;
				this.logger.info(`Channel ${channelId} not found`);
			}
			return true;
		} catch (error) {
			if (generation === this.joinGeneration) this.currentChannelId = "";
			this.logger.error(`Failed to join channel ${channelId}:`, error);
			throw error;
		}
	}

	async getWatchTime(username: string, period: XayoWatchtimePeriod): Promise<EnhancerStreamerWatchTimeData[]> {
		const watchtime = await this.worker.send("getEnhancerWatchTime", { username, period, platform: this.platform });
		if (!watchtime) throw new Error("Enhancer watchtime request timed out");
		return watchtime;
	}

	findUserBadgesForCurrentChannel(externalUserId: string): EnhancerBadge[] {
		const badges = new Map<string, EnhancerBadge>();
		for (const view of [this.globalView, this.currentView]) {
			const account = view?.findAccount(externalUserId);
			if (!view || !account) continue;
			for (const badgeId of account.badgesIds) {
				const badge = view.findBadge(badgeId);
				if (badge) badges.set(badge.badgeId, badge);
			}
		}
		return [...badges.values()].sort((left, right) => left.priority - right.priority);
	}

	findUserForCurrentChannel(externalUserId: string): EnhancerAccount | null {
		return this.currentView?.findAccount(externalUserId) ?? this.globalView?.findAccount(externalUserId) ?? null;
	}

	getCustomFonts(): string[] {
		return [...new Set([...(this.globalView?.customFonts() ?? []), ...(this.currentView?.customFonts() ?? [])])];
	}

	private async loadGlobal(knownHash = this.globalView?.hash): Promise<void> {
		const seed = await this.worker.send("initializeEnhancerApi", {
			platform: this.platform,
			clientId: this.clientId,
			...(knownHash ? { knownHash } : {}),
		});
		if (!seed) throw new Error("Enhancer API initialization timed out");
		if (!this.installSeed("GLOBAL", seed)) {
			if (!knownHash) throw new Error("Enhancer API returned a seed without its snapshot");
			return this.loadGlobal(undefined);
		}
		this.globalTopic = seed.topic;
		this.emitter.emit("extension:enhancer-api-refresh");
	}

	private async requestChannel(
		channelId: string,
		generation: number,
		knownHash?: string,
	): Promise<{ seed: AggregateSeed | null }> {
		const response = await this.worker.send("joinEnhancerChannel", {
			platform: this.platform,
			externalId: channelId,
			clientId: this.clientId,
			...(knownHash ? { knownHash } : {}),
		});
		if (!response) throw new Error("Enhancer channel request timed out");
		if (generation !== this.joinGeneration) return response;
		if (response.seed && !this.installSeed("CHANNEL", response.seed)) {
			if (!knownHash) throw new Error("Enhancer API returned a seed without its snapshot");
			return this.requestChannel(channelId, generation);
		}
		if (response.seed) this.emitter.emit("extension:enhancer-api-refresh");
		return response;
	}

	private installSeed(scope: AggregateScope, seed: AggregateSeed): boolean {
		const existing = scope === "GLOBAL" ? this.globalView : this.currentView;
		let view: EnhancerAggregateView;
		if (seed.bytes) view = new EnhancerAggregateView(seed.hash, seed.seq, decodeBase64(seed.bytes));
		else if (existing?.hash === seed.hash) view = existing;
		else return false;
		view.resetOverlay();
		view.applyEntries(seed.accounts, seed.badges);
		view.seq = seed.seq;
		if (scope === "GLOBAL") this.globalView = view;
		else {
			this.currentView = view;
			this.currentTopic = seed.topic;
		}
		const pending = this.pendingPatches.get(seed.topic) ?? [];
		this.pendingPatches.delete(seed.topic);
		for (const patch of pending.sort((left, right) => left.seq - right.seq)) {
			if (patch.seq !== view.seq + 1) continue;
			view.applyEntries(patch.accounts, patch.badges);
			view.seq = patch.seq;
		}
		return true;
	}

	private resync(scope: AggregateScope): void {
		if (this.resyncing.has(scope)) return;
		this.resyncing.add(scope);
		const request =
			scope === "GLOBAL"
				? this.loadGlobal(undefined)
				: this.currentChannelId
					? this.requestChannel(this.currentChannelId, this.joinGeneration).then(() => undefined)
					: Promise.resolve();
		void request
			.catch((error) => this.logger.error(`Failed to resynchronize ${scope.toLowerCase()} aggregate:`, error))
			.finally(() => this.resyncing.delete(scope));
	}

	private readonly handleUpdate = (payload: EnhancerApiUpdatedPayload): void => {
		if (payload.platform !== this.platform || payload.clientId !== this.clientId) return;
		if (payload.scope === "GLOBAL") {
			if (!payload.seed) this.globalView = null;
			else if (!this.installSeed("GLOBAL", payload.seed)) return this.resync("GLOBAL");
		} else if (payload.topic === this.currentTopic) {
			const nextTopic = payload.replacementTopic ?? payload.topic;
			if (!payload.seed) this.currentView = null;
			else if (!this.installSeed("CHANNEL", payload.seed)) {
				this.currentTopic = nextTopic;
				return this.resync("CHANNEL");
			}
			this.currentTopic = nextTopic;
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

	private readonly handlePatch = (payload: EnhancerApiPatchPayload): void => {
		if (payload.platform !== this.platform || payload.clientId !== this.clientId) return;
		const scope: AggregateScope | null =
			payload.topic === this.globalTopic ? "GLOBAL" : payload.topic === this.currentTopic ? "CHANNEL" : null;
		if (!scope) return;
		const view = scope === "GLOBAL" ? this.globalView : this.currentView;
		if (!view || this.resyncing.has(scope)) {
			const pending = this.pendingPatches.get(payload.topic) ?? [];
			if (pending.length < EnhancerApi.MAX_PENDING_PATCHES) pending.push(payload);
			this.pendingPatches.set(payload.topic, pending);
			return;
		}
		if (payload.seq <= view.seq) return;
		if (payload.seq !== view.seq + 1) return this.resync(scope);
		view.applyEntries(payload.accounts, payload.badges);
		view.seq = payload.seq;
		this.emitter.emit("extension:enhancer-api-refresh");
	};

	private readonly handleMessage = (payload: EnhancerApiMessagePayload): void => {
		if (payload.platform !== this.platform || payload.clientId !== this.clientId) return;
		if (payload.message.target.scope === "CHANNEL" && payload.topic !== this.currentTopic) return;
		this.emitter.emit("extension:enhancer-api-message", payload.message);
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
