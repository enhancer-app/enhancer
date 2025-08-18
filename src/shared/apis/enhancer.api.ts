import { HttpClient } from "$shared/http/http-client.ts";
import { Logger } from "$shared/logger/logger.ts";
import type {
	EnhancerBadge,
	EnhancerChannelDto,
	EnhancerStreamerWatchTimeData,
	EnhancerUser,
} from "$types/apis/enhancer.apis.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";

interface ApiResponse<T> {
	data: T;
	ok: boolean;
	status: number;
}

export default class EnhancerApi {
	private currentChannelId = "";
	private readonly cache = new Map<string, any>();
	private isInitialized = false;

	private static readonly GLOBAL_CHANNEL_ID = "0";
	private static readonly API_URL = "https://api2.enhancer.at";
	//private static readonly API_URL = "http://localhost:8080";

	private static readonly CACHE_KEYS = {
		GLOBAL: "global",
		CHANNEL: (id: string) => `channel:${id}`,
	} as const;

	private readonly logger = new Logger({ context: "enhancer-api" });
	private readonly httpClient = new HttpClient(this.logger);

	constructor(private readonly platform: PlatformType) {}

	async initialize(): Promise<void> {
		if (this.isInitialized) return;

		try {
			const globalChannel = await this.fetchChannel(EnhancerApi.GLOBAL_CHANNEL_ID);
			if (globalChannel.ok) {
				this.cache.set(EnhancerApi.CACHE_KEYS.GLOBAL, globalChannel.data);
				this.logger.debug("Global channel loaded successfully");
			} else {
				this.logger.warn("Failed to load global channel");
			}
		} catch (error) {
			this.logger.error("Error initializing EnhancerApi:", error);
		} finally {
			this.isInitialized = true;
		}
	}

	async joinChannel(channelId: string): Promise<void> {
		if (!channelId || channelId === this.currentChannelId) return;
		try {
			const { data: channelData } = await this.fetchChannel(channelId);
			this.handleChannelResult(channelId, channelData);
			this.currentChannelId = channelId;
			this.logger.info(`Successfully joined channel: ${channelId}`);
		} catch (error) {
			this.logger.error(`Failed to join channel ${channelId}:`, error);
			throw error;
		}
	}

	getGlobalChannel(): EnhancerChannelDto | null {
		return this.cache.get(EnhancerApi.CACHE_KEYS.GLOBAL) ?? null;
	}

	getCurrentChannel(): EnhancerChannelDto | null {
		return this.getCurrentChannelData(EnhancerApi.CACHE_KEYS.CHANNEL);
	}

	async getChannelById(channelId: string): Promise<EnhancerChannelDto | null> {
		const cacheKey = EnhancerApi.CACHE_KEYS.CHANNEL(channelId);
		const cached = this.cache.get(cacheKey);
		if (cached) return cached;

		const result = await this.fetchChannel(channelId);
		if (result.ok) {
			this.cache.set(cacheKey, result.data);
			return result.data;
		}
		return null;
	}

	async getWatchTime(username: string): Promise<EnhancerStreamerWatchTimeData[]> {
		const { data } = await this.httpClient.request<EnhancerStreamerWatchTimeData[]>(
			`${EnhancerApi.API_URL}/xayo/${username}`,
			{
				method: "GET",
				validateStatus: (status) => status === 200,
				responseType: "json",
			},
		);
		return data;
	}

	findUserBadgesForCurrentChannel(externalUserId: string): EnhancerBadge[] {
		const globalChannel = this.getGlobalChannel();
		const currentChannel = this.getCurrentChannel();

		const globalUser = globalChannel?.users.find((user) => user.externalId === externalUserId);
		const channelUser = currentChannel?.users.find((user) => user.externalId === externalUserId);

		const userBadgeIds = new Set([...(globalUser?.badgesIds ?? []), ...(channelUser?.badgesIds ?? [])]);
		const allBadges = [...(globalChannel?.badges ?? []), ...(currentChannel?.badges ?? [])];
		const userBadges = allBadges.filter((badge) => userBadgeIds.has(badge.badgeId));

		const uniqueBadges = Array.from(new Map(userBadges.map((badge) => [badge.badgeId, badge])).values());
		return uniqueBadges.sort((a, b) => a.priority - b.priority);
	}

	findUserForCurrentChannel(externalUserId: string): EnhancerUser | null {
		const channelUser = this.getCurrentChannel()?.users.find((user) => user.externalId === externalUserId);
		if (channelUser) {
			return channelUser;
		}
		const globalUser = this.getGlobalChannel()?.users.find((user) => user.externalId === externalUserId);
		return globalUser ?? null;
	}

	getCurrentChannelId(): string {
		return this.currentChannelId;
	}

	isChannelJoined(): boolean {
		return Boolean(this.currentChannelId);
	}

	clearCache(): void {
		this.cache.clear();
		this.currentChannelId = "";
		this.isInitialized = false;
	}

	private async fetchChannel(channelId: string): Promise<ApiResponse<EnhancerChannelDto>> {
		const { data, status } = await this.httpClient.request<EnhancerChannelDto>(
			`${EnhancerApi.API_URL}/v2/channel/${this.platform}/${channelId}`,
			{
				method: "GET",
				responseType: "json",
				validateStatus: (status) => [200, 404].includes(status),
			},
		);
		return { data, ok: status === 200, status };
	}

	private getCurrentChannelData<T>(keyFactory: (id: string) => string): T | null {
		if (!this.currentChannelId) return null;
		return this.cache.get(keyFactory(this.currentChannelId)) ?? null;
	}

	private handleChannelResult(channelId: string, data: EnhancerChannelDto): void {
		this.cache.set(EnhancerApi.CACHE_KEYS.CHANNEL(channelId), data);
	}
}
