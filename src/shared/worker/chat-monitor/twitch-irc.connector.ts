import { Logger } from "$shared/logger/logger.ts";
import type { ChatMonitorKeywordMatch } from "$types/shared/chat-monitor/chat-monitor.types.ts";

export class TwitchIRCConnector {
	private readonly logger = new Logger({ context: "twitch-irc" });
	private socket: WebSocket | null = null;
	private channels = new Set<string>();
	private keywords = new Set<string>();
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectTimeout: NodeJS.Timeout | null = null;
	private pingInterval: NodeJS.Timeout | null = null;

	constructor(private onKeywordMatch: (match: ChatMonitorKeywordMatch) => void) {}

	async connect(): Promise<void> {
		try {
			this.socket = new WebSocket("wss://irc-ws.chat.twitch.tv:443");

			this.socket.onopen = () => {
				this.logger.info("Connected to Twitch IRC");
				this.reconnectAttempts = 0;
				this.authenticate();
				this.startPingInterval();
			};

			this.socket.onmessage = (event) => {
				this.handleMessage(event.data);
			};

			this.socket.onerror = (error) => {
				this.logger.error("Twitch IRC error:", error);
			};

			this.socket.onclose = () => {
				this.logger.info("Disconnected from Twitch IRC");
				this.stopPingInterval();
				this.attemptReconnect();
			};
		} catch (error) {
			this.logger.error("Failed to connect to Twitch IRC:", error);
			this.attemptReconnect();
		}
	}

	private authenticate(): void {
		if (!this.socket) return;

		// Anonymous connection
		this.socket.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
		this.socket.send("PASS SCHMOOPIIE");
		this.socket.send("NICK justinfan12345");

		// Re-join channels after reconnection
		for (const channel of this.channels) {
			this.joinChannel(channel);
		}
	}

	private startPingInterval(): void {
		this.pingInterval = setInterval(() => {
			if (this.socket?.readyState === WebSocket.OPEN) {
				this.socket.send("PING :tmi.twitch.tv");
			}
		}, 60000); // Send PING every 60 seconds
	}

	private stopPingInterval(): void {
		if (this.pingInterval) {
			clearInterval(this.pingInterval);
			this.pingInterval = null;
		}
	}

	private attemptReconnect(): void {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			this.logger.error("Max reconnection attempts reached for Twitch IRC");
			return;
		}

		this.reconnectAttempts++;
		const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
		this.logger.info(`Attempting to reconnect to Twitch IRC in ${delay}ms (attempt ${this.reconnectAttempts})`);

		this.reconnectTimeout = setTimeout(() => {
			this.connect();
		}, delay);
	}

	joinChannel(channel: string): void {
		const normalizedChannel = channel.toLowerCase();
		this.channels.add(normalizedChannel);

		if (this.socket?.readyState === WebSocket.OPEN) {
			this.socket.send(`JOIN #${normalizedChannel}`);
			this.logger.debug(`Joined Twitch channel: ${normalizedChannel}`);
		}
	}

	leaveChannel(channel: string): void {
		const normalizedChannel = channel.toLowerCase();
		this.channels.delete(normalizedChannel);

		if (this.socket?.readyState === WebSocket.OPEN) {
			this.socket.send(`PART #${normalizedChannel}`);
			this.logger.debug(`Left Twitch channel: ${normalizedChannel}`);
		}
	}

	setKeywords(keywords: string[]): void {
		this.keywords = new Set(keywords.map((k) => k.toLowerCase()));
	}

	private handleMessage(data: string): void {
		const lines = data.split("\r\n").filter((line) => line.length > 0);

		for (const line of lines) {
			if (line.startsWith("PING")) {
				this.socket?.send("PONG :tmi.twitch.tv");
				continue;
			}

			if (line.includes("PRIVMSG")) {
				this.handleChatMessage(line);
			}
		}
	}

	private handleChatMessage(line: string): void {
		try {
			// Parse IRC message: @tags :user!user@user.tmi.twitch.tv PRIVMSG #channel :message
			const messageParts = line.split(" ");
			const tags: Record<string, string> = {};

			// Parse tags
			if (line.startsWith("@")) {
				const tagsPart = messageParts[0].substring(1);
				for (const tag of tagsPart.split(";")) {
					const [key, value] = tag.split("=");
					if (key && value !== undefined) {
						tags[key] = value;
					}
				}
			}

			// Find channel
			const channelIndex = messageParts.findIndex((part) => part.startsWith("#"));
			if (channelIndex === -1) return;

			const channel = messageParts[channelIndex].substring(1);

			// Find message content
			const messageIndex = messageParts.findIndex((part) => part === `:${messageParts[channelIndex]}`);
			if (messageIndex === -1) return;

			const message = messageParts
				.slice(messageIndex + 1)
				.join(" ")
				.substring(1);
			const username = tags["display-name"] || "Unknown";

			// Check for keywords
			const messageLower = message.toLowerCase();
			for (const keyword of this.keywords) {
				if (messageLower.includes(keyword)) {
					this.onKeywordMatch({
						platform: "twitch",
						channel,
						username,
						message,
						keyword,
						timestamp: Date.now(),
					});
				}
			}
		} catch (error) {
			this.logger.error("Failed to parse Twitch chat message:", error);
		}
	}

	disconnect(): void {
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}

		this.stopPingInterval();

		if (this.socket) {
			this.socket.close();
			this.socket = null;
		}

		this.channels.clear();
		this.reconnectAttempts = 0;
		this.logger.info("Disconnected from Twitch IRC");
	}

	isConnected(): boolean {
		return this.socket?.readyState === WebSocket.OPEN;
	}
}
