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

	private async run([chatRoom]: Element[]): Promise<void> {
		[...chatRoom.querySelectorAll(".ntv__chat-message"), ...chatRoom.querySelectorAll("div[data-index]")].forEach(
			(message) => this.handleMessage(message),
		);
		await this.initializeChannel();
		this.createObserver(chatRoom);
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
			await this.enhancerApi().joinChannel(channelId);
			this.logger.debug(`Joined channel ${channelId}`);
		} catch (error) {
			this.logger.error("Failed to join channel", error);
		}
	}

	private getMessageData(element: Element): Omit<KickChatMessageEvent, "isUsingNTV"> | null {
		const messageData = this.kickUtils().getMessageData(element);
		if (!messageData) return null;
		return {
			message: messageData,
			element,
		};
	}

	private async handleMessage(element: Element) {
		try {
			if (this.isMessageHandled(element)) return;
			const messageData = this.getMessageData(element);
			if (!messageData) return;
			if (!element.matches("div[data-index]")) return;
			this.markMessageAsHandled(element);
			await this.commonUtils().delay(20); // Have to leave this delay, because NTV rendering can be disabled via NTV options
			const isUsingNTV = this.kickUtils().isUsingNTV(element);
			this.emitter.emit("kick:chatMessage", { ...messageData, isUsingNTV });
		} catch (err) {
			this.logger.error("Failed to parse chat message", err);
		}
	}

	private createObserver(chatRoom: Element): void {
		this.observer?.disconnect();
		this.observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				for (const node of mutation.addedNodes) {
					if (node instanceof HTMLElement) {
						this.handleMessage(node);
					}
				}
			}
		});
		this.observer.observe(chatRoom, { childList: true, subtree: true });
	}

	private isMessageHandled(element: Element) {
		return element.hasAttribute("enhancer-message-handled");
	}

	private markMessageAsHandled(element: Element) {
		element.setAttribute("enhancer-message-handled", "true");
	}
}
