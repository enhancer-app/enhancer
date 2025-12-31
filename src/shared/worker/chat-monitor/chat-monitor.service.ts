import { Logger } from "$shared/logger/logger.ts";
import { KickIRCConnector } from "$shared/worker/chat-monitor/kick-irc.connector.ts";
import { TwitchIRCConnector } from "$shared/worker/chat-monitor/twitch-irc.connector.ts";
import type { ChatMonitorChannel, ChatMonitorKeywordMatch } from "$types/shared/chat-monitor/chat-monitor.types.ts";

export class ChatMonitorService {
	private readonly logger = new Logger({ context: "chat-monitor-service" });
	private twitchConnector: TwitchIRCConnector | null = null;
	private kickConnector: KickIRCConnector | null = null;
	private enabled = false;
	private keywords: string[] = [];
	private channels: ChatMonitorChannel[] = [];
	private keywordMatches: ChatMonitorKeywordMatch[] = [];
	private readonly maxMatches = 100;

	constructor(private onKeywordMatch?: (match: ChatMonitorKeywordMatch) => void) {}

	async initialize(): Promise<void> {
		this.logger.info("Chat monitor service initialized");
	}

	async start(channels: ChatMonitorChannel[], keywords: string[]): Promise<void> {
		if (this.enabled) {
			this.logger.info("Chat monitor already running");
			return;
		}

		this.enabled = true;
		this.channels = channels;
		this.keywords = keywords;

		// Separate channels by platform
		const twitchChannels = channels.filter((c) => c.platform === "twitch").map((c) => c.channel);
		const kickChannels = channels.filter((c) => c.platform === "kick").map((c) => c.channel);

		// Start Twitch connector if there are Twitch channels
		if (twitchChannels.length > 0) {
			this.twitchConnector = new TwitchIRCConnector(this.handleKeywordMatch.bind(this));
			this.twitchConnector.setKeywords(keywords);
			await this.twitchConnector.connect();

			for (const channel of twitchChannels) {
				this.twitchConnector.joinChannel(channel);
			}
		}

		// Start Kick connector if there are Kick channels
		if (kickChannels.length > 0) {
			this.kickConnector = new KickIRCConnector(this.handleKeywordMatch.bind(this));
			this.kickConnector.setKeywords(keywords);
			await this.kickConnector.connect();

			for (const channel of kickChannels) {
				this.kickConnector.joinChannel(channel);
			}
		}

		this.logger.info(`Chat monitor started with ${channels.length} channels and ${keywords.length} keywords`);
	}

	stop(): void {
		if (!this.enabled) {
			return;
		}

		this.enabled = false;

		if (this.twitchConnector) {
			this.twitchConnector.disconnect();
			this.twitchConnector = null;
		}

		if (this.kickConnector) {
			this.kickConnector.disconnect();
			this.kickConnector = null;
		}

		this.logger.info("Chat monitor stopped");
	}

	updateChannels(channels: ChatMonitorChannel[]): void {
		const oldChannels = this.channels;
		this.channels = channels;

		if (!this.enabled) {
			return;
		}

		// Separate channels by platform
		const twitchChannels = channels.filter((c) => c.platform === "twitch").map((c) => c.channel);
		const kickChannels = channels.filter((c) => c.platform === "kick").map((c) => c.channel);

		const oldTwitchChannels = oldChannels.filter((c) => c.platform === "twitch").map((c) => c.channel);
		const oldKickChannels = oldChannels.filter((c) => c.platform === "kick").map((c) => c.channel);

		// Update Twitch connector
		if (twitchChannels.length > 0 && !this.twitchConnector) {
			this.twitchConnector = new TwitchIRCConnector(this.handleKeywordMatch.bind(this));
			this.twitchConnector.setKeywords(this.keywords);
			this.twitchConnector.connect();
		} else if (twitchChannels.length === 0 && this.twitchConnector) {
			this.twitchConnector.disconnect();
			this.twitchConnector = null;
		}

		if (this.twitchConnector) {
			// Remove old channels
			for (const channel of oldTwitchChannels) {
				if (!twitchChannels.includes(channel)) {
					this.twitchConnector.leaveChannel(channel);
				}
			}

			// Add new channels
			for (const channel of twitchChannels) {
				if (!oldTwitchChannels.includes(channel)) {
					this.twitchConnector.joinChannel(channel);
				}
			}
		}

		// Update Kick connector
		if (kickChannels.length > 0 && !this.kickConnector) {
			this.kickConnector = new KickIRCConnector(this.handleKeywordMatch.bind(this));
			this.kickConnector.setKeywords(this.keywords);
			this.kickConnector.connect();
		} else if (kickChannels.length === 0 && this.kickConnector) {
			this.kickConnector.disconnect();
			this.kickConnector = null;
		}

		if (this.kickConnector) {
			// Remove old channels
			for (const channel of oldKickChannels) {
				if (!kickChannels.includes(channel)) {
					this.kickConnector.leaveChannel(channel);
				}
			}

			// Add new channels
			for (const channel of kickChannels) {
				if (!oldKickChannels.includes(channel)) {
					this.kickConnector.joinChannel(channel);
				}
			}
		}

		this.logger.info(`Chat monitor channels updated: ${channels.length} total`);
	}

	updateKeywords(keywords: string[]): void {
		this.keywords = keywords;

		if (this.twitchConnector) {
			this.twitchConnector.setKeywords(keywords);
		}

		if (this.kickConnector) {
			this.kickConnector.setKeywords(keywords);
		}

		this.logger.info(`Chat monitor keywords updated: ${keywords.length} total`);
	}

	private handleKeywordMatch(match: ChatMonitorKeywordMatch): void {
		this.keywordMatches.unshift(match);

		// Keep only the last maxMatches
		if (this.keywordMatches.length > this.maxMatches) {
			this.keywordMatches = this.keywordMatches.slice(0, this.maxMatches);
		}

		this.logger.debug(`Keyword match: ${match.keyword} in ${match.platform}/${match.channel} by ${match.username}`);

		// Notify callback if provided
		if (this.onKeywordMatch) {
			this.onKeywordMatch(match);
		}
	}

	getRecentMatches(limit = 20): ChatMonitorKeywordMatch[] {
		return this.keywordMatches.slice(0, limit);
	}

	clearMatches(): void {
		this.keywordMatches = [];
	}

	isEnabled(): boolean {
		return this.enabled;
	}

	getStatus(): {
		enabled: boolean;
		twitchConnected: boolean;
		kickConnected: boolean;
		channelCount: number;
		keywordCount: number;
	} {
		return {
			enabled: this.enabled,
			twitchConnected: this.twitchConnector?.isConnected() ?? false,
			kickConnected: this.kickConnector?.isConnected() ?? false,
			channelCount: this.channels.length,
			keywordCount: this.keywords.length,
		};
	}
}
