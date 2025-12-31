import { Logger } from "$shared/logger/logger.ts";
import type { ChatMonitorKeywordMatch } from "$types/shared/chat-monitor/chat-monitor.types.ts";

export class KickIRCConnector {
	private readonly logger = new Logger({ context: "kick-irc" });
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
			this.socket = new WebSocket("wss://ws-us2.pusher.com/app/eb1d5f283081a78b932c?protocol=7&client=js&version=7.6.0&flash=false");

			this.socket.onopen = () => {
				this.logger.info("Connected to Kick WebSocket");
				this.reconnectAttempts = 0;
				this.startPingInterval();
				
				// Re-join channels after reconnection
				for (const channel of this.channels) {
					this.subscribeToChannel(channel);
				}
			};

			this.socket.onmessage = (event) => {
				this.handleMessage(event.data);
			};

			this.socket.onerror = (error) => {
				this.logger.error("Kick WebSocket error:", error);
			};

			this.socket.onclose = () => {
				this.logger.info("Disconnected from Kick WebSocket");
				this.stopPingInterval();
				this.attemptReconnect();
			};
		} catch (error) {
			this.logger.error("Failed to connect to Kick WebSocket:", error);
			this.attemptReconnect();
		}
	}

	private startPingInterval(): void {
		this.pingInterval = setInterval(() => {
			if (this.socket?.readyState === WebSocket.OPEN) {
				this.socket.send(JSON.stringify({ event: "pusher:ping", data: {} }));
			}
		}, 30000); // Send ping every 30 seconds
	}

	private stopPingInterval(): void {
		if (this.pingInterval) {
			clearInterval(this.pingInterval);
			this.pingInterval = null;
		}
	}

	private attemptReconnect(): void {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			this.logger.error("Max reconnection attempts reached for Kick WebSocket");
			return;
		}

		this.reconnectAttempts++;
		const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
		this.logger.info(`Attempting to reconnect to Kick WebSocket in ${delay}ms (attempt ${this.reconnectAttempts})`);

		this.reconnectTimeout = setTimeout(() => {
			this.connect();
		}, delay);
	}

	joinChannel(channel: string): void {
		const normalizedChannel = channel.toLowerCase();
		this.channels.add(normalizedChannel);
		
		if (this.socket?.readyState === WebSocket.OPEN) {
			this.subscribeToChannel(normalizedChannel);
		}
	}

	private subscribeToChannel(channel: string): void {
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

		// Subscribe to the chatrooms channel for this Kick channel
		const channelName = `chatrooms.${channel}.v2`;
		this.socket.send(JSON.stringify({
			event: "pusher:subscribe",
			data: {
				auth: "",
				channel: channelName,
			},
		}));
		this.logger.debug(`Subscribed to Kick channel: ${channel}`);
	}

	leaveChannel(channel: string): void {
		const normalizedChannel = channel.toLowerCase();
		this.channels.delete(normalizedChannel);

		if (this.socket?.readyState === WebSocket.OPEN) {
			const channelName = `chatrooms.${normalizedChannel}.v2`;
			this.socket.send(JSON.stringify({
				event: "pusher:unsubscribe",
				data: {
					channel: channelName,
				},
			}));
			this.logger.debug(`Unsubscribed from Kick channel: ${normalizedChannel}`);
		}
	}

	setKeywords(keywords: string[]): void {
		this.keywords = new Set(keywords.map((k) => k.toLowerCase()));
	}

	private handleMessage(data: string): void {
		try {
			const message = JSON.parse(data);

			if (message.event === "pusher:pong") {
				return;
			}

			if (message.event === "pusher:connection_established") {
				this.logger.debug("Kick WebSocket connection established");
				return;
			}

			// Handle chat messages
			if (message.event === "App\\Events\\ChatMessageEvent") {
				this.handleChatMessage(message);
			}
		} catch (error) {
			this.logger.error("Failed to parse Kick WebSocket message:", error);
		}
	}

	private handleChatMessage(message: any): void {
		try {
			if (!message.data) return;

			const data = typeof message.data === "string" ? JSON.parse(message.data) : message.data;
			
			const username = data.sender?.username || "Unknown";
			const content = data.content || "";
			const channelSlug = data.chatroom?.slug || "";

			// Check for keywords
			const contentLower = content.toLowerCase();
			for (const keyword of this.keywords) {
				if (contentLower.includes(keyword)) {
					this.onKeywordMatch({
						platform: "kick",
						channel: channelSlug,
						username,
						message: content,
						keyword,
						timestamp: Date.now(),
					});
				}
			}
		} catch (error) {
			this.logger.error("Failed to parse Kick chat message:", error);
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
		this.logger.info("Disconnected from Kick WebSocket");
	}

	isConnected(): boolean {
		return this.socket?.readyState === WebSocket.OPEN;
	}
}
