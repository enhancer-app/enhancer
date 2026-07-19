import KickModule from "$kick/kick.module.ts";
import type { KickChatMessageEvent } from "$types/platforms/kick/kick.events.types.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";

export default class ChatModule extends KickModule {
	readonly config: KickModuleConfig = {
		name: "chat",
		appliers: [
			{
				type: "selector",
				selectors: ["#channel-chatroom"],
				callback: this.run.bind(this),
				key: "chat",
				once: true,
			},
		],
	};

	private observer: MutationObserver | undefined;
	private readonly pendingMessages = new Set<Element>();
	private animationFrame: number | undefined;

	private async run([chatRoom]: Element[]): Promise<void> {
		this.createObserver(chatRoom);
		chatRoom.querySelectorAll("div[data-index]").forEach((message) => this.scheduleMessage(message));
		await this.initializeChannel();
	}

	private async initializeChannel() {
		let channelId: string | undefined;
		await this.commonUtils().waitFor(
			() => this.kickUtils().getChannelInfo(),
			async (channelInfo) => {
				channelId = channelInfo.channelId.toString();
				return true;
			},
			{ maxRetries: 5, delay: 100 },
		);
		if (!channelId) {
			try {
				const chatRoom = this.kickUtils().getChannelChatRoomInfo();
				if (!chatRoom) {
					this.logger.error("Failed to find chat room component");
					return;
				}
				const { data } = await this.kickApi().getChannel(chatRoom.slug);
				channelId = data.id.toString();
			} catch (error) {
				this.logger.error("Failed to get channel data", error);
			}
		}
		if (!channelId) return;
		try {
			const joined = await this.enhancerApi().joinChannel(channelId);
			if (joined) {
				this.emitter.emit("extension:joined-channel");
				this.logger.info(`Joined channel ${channelId}`);
			}
		} catch (error) {
			this.logger.error("Failed to join channel", error);
		}
	}

	private getMessageData(element: Element): Omit<KickChatMessageEvent, "isUsingNTV" | "isRerender"> | null {
		const messageData = this.kickUtils().getMessageData(element);
		if (!messageData) return null;
		return {
			message: messageData,
			element,
		};
	}

	private handleMessage(element: Element) {
		try {
			if (!element.isConnected) return;
			if (element.classList.contains("ntv__chat-message--unrendered")) {
				const marker = element.getAttribute("enhancer-message-handled");
				if (marker && !marker.endsWith(":PENDING")) {
					const colonIndex = marker.lastIndexOf(":");
					const baseMarker = colonIndex === -1 ? marker : marker.slice(0, colonIndex);
					element.setAttribute("enhancer-message-handled", `${baseMarker}:PENDING`);
				}
				return;
			}
			const messageData = this.getMessageData(element);
			if (!messageData) return;
			const isUsingNTV = this.kickUtils().isUsingNTV(element);
			const marker = `${messageData.message.id}:${isUsingNTV ? "NTV" : "KICK"}`;
			const previousMarker = element.getAttribute("enhancer-message-handled");
			if (previousMarker === marker) return;
			element.setAttribute("enhancer-message-handled", marker);
			this.emitter.emit("kick:chatMessage", {
				...messageData,
				isUsingNTV,
				isRerender: previousMarker?.startsWith(`${messageData.message.id}:`) ?? false,
			});
		} catch (err) {
			this.logger.error("Failed to parse chat message", err);
		}
	}

	private scheduleMessage(element: Element) {
		this.pendingMessages.add(element);
		if (this.animationFrame !== undefined) return;
		this.animationFrame = requestAnimationFrame(() => {
			this.animationFrame = undefined;
			const messages = Array.from(this.pendingMessages);
			this.pendingMessages.clear();
			for (const message of messages) this.handleMessage(message);
		});
	}

	private scheduleMessagesFromNode(node: Node) {
		if (!(node instanceof Element)) return;
		const parentMessage = node.closest("div[data-index]");
		if (parentMessage) {
			this.scheduleMessage(parentMessage);
			return;
		}
		node.querySelectorAll("div[data-index]").forEach((message) => this.scheduleMessage(message));
	}

	private createObserver(chatRoom: Element): void {
		this.observer?.disconnect();
		this.observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === "attributes") this.scheduleMessagesFromNode(mutation.target);
				for (const node of mutation.addedNodes) this.scheduleMessagesFromNode(node);
			}
		});
		this.observer.observe(chatRoom, {
			attributes: true,
			attributeFilter: ["class"],
			childList: true,
			subtree: true,
		});
	}
}
