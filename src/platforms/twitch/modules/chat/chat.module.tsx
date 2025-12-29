import QueueFactory from "$shared/queue/queue-factory.ts";
import type { TwitchChatMessage } from "$types/platforms/twitch/twitch.utils.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import type { QueueValue } from "$types/shared/queue.types.ts";
import TwitchModule from "../../twitch.module.ts";
import type ChatMessageListener from "./listener/chat-message.listener.ts";
import SeventvChatMessageListener from "./listener/seventv-chat-message.listener.ts";
import TwitchChatMessageListener from "./listener/twitch-chat-message.listener.ts";

export default class ChatModule extends TwitchModule {
	static readonly TWITCHTV_CHAT_SELECTOR = ".chat-scrollable-area__message-container";
	static readonly SEVENTV_CHAT_SELECTOR = "main.seventv-chat-list";
	static readonly VALID_MESSAGE_TYPES_IDS = [0];
	static readonly LINK_MESSAGE_ID = 51;

	private listener = {} as ChatMessageListener;
	private observer: MutationObserver | undefined;
	private readonly queue = new QueueFactory<TwitchChatMessage & QueueValue>().create({ expire: 300 });
	private type: "TWITCH" | "7TV" = "TWITCH";

	readonly config: TwitchModuleConfig = {
		name: "chat",
		appliers: [
			{
				type: "selector",
				key: "chat",
				selectors: [ChatModule.TWITCHTV_CHAT_SELECTOR, ChatModule.SEVENTV_CHAT_SELECTOR],
				callback: this.run.bind(this),
				once: true,
			},
			{
				type: "event",
				key: "chat",
				event: "twitch:chatInitialized",
				callback: this.initializeChannel.bind(this),
			},
		],
	};

	private async initializeChannel(channelId: string) {
		try {
			await this.enhancerApi().joinChannel(channelId);
			this.logger.info(`Joined channel ${channelId}`);
		} catch (error) {
			this.logger.error("Failed to join channel", error);
		}
	}

	private run(elements: Element[]) {
		if (elements.length > 1) this.logger.warn("Found multiple chat elements");
		const element = elements[0];
		if (element.classList.contains(ChatModule.TWITCHTV_CHAT_SELECTOR.replace(".", ""))) {
			this.type = "TWITCH";
			this.listener = new TwitchChatMessageListener(this.logger, this.twitchUtils());
		} else if (element.className.includes("seventv")) {
			this.type = "7TV";
			this.listener = new SeventvChatMessageListener(this.logger, this.twitchUtils());
		}
		this.listener.emitter.on("inject", () => this.logger.info(`Injected ${this.type} chat module`));
		this.listener.emitter.on("message", (message) => this.handleMessage(message));
		this.listener.inject();
		this.createObserver(elements);

		this.broadcastInitializeChannel();
	}

	async broadcastInitializeChannel() {
		await this.commonUtils()
			.waitFor<string>(
				() => {
					return this.twitchUtils().getChatController()?.props.channelID;
				},
				(channelId, attempt) => {
					this.emitter.emit("twitch:chatInitialized", channelId);
					this.logger.info(`Initialized chat (attempt: ${attempt})`);
					return true;
				},
				{ delay: 100, maxRetries: 20, initialDelay: 30 },
			)
			.catch(() => this.logger.warn("Failed to detect channelID for chat initialization after 20 attempts."));
	}

	private createObserver(elements: Element[]) {
		this.observer?.disconnect();
		this.observer = new MutationObserver(async (list) => {
			for (const mutation of list) {
				if (mutation.type === "childList" && mutation.addedNodes) {
					for (const node of mutation.addedNodes) {
						const element = node as Element;
						const seventvId = element.getAttribute("msg-id");
						const messageProps = this.twitchUtils().getChatMessage(node);
						const id = seventvId ?? messageProps?.message.id;
						if (!id) continue;
						let message = this.queue.getAndRemove(id);
						if (messageProps?.message.nonce && !message) message = this.queue.getAndRemove(messageProps?.message.nonce); // Handling re-rendering handlers
						if (!message) continue;
						this.emitter.emit("twitch:chatMessage", {
							element,
							message,
							type: this.type,
						});
					}
				}
			}
		});
		elements.forEach((element) => this.observer?.observe(element, { attributes: true, childList: true }));
	}

	private isWrappedMessage(message: TwitchChatMessage) {
		const wrappedMessage = message.message;
		if (!wrappedMessage || typeof wrappedMessage !== "object" || wrappedMessage === null) {
			return false;
		}
		return (
			"id" in wrappedMessage &&
			"user" in wrappedMessage &&
			("message" in wrappedMessage || "messageBody" in wrappedMessage)
		);
	}

	private async handleMessage(_message: TwitchChatMessage) {
		let message = _message;

		const isWrappedMessage = this.isWrappedMessage(message);
		if (isWrappedMessage) {
			this.logger.debug("Found wrapped message, replacing it...");
			message = message.message as unknown as TwitchChatMessage;
		}

		if (ChatModule.VALID_MESSAGE_TYPES_IDS.includes(message.type) || isWrappedMessage) {
			if (message.id) {
				this.queue.addByValue({
					...message,
					queueKey: message.id,
				});
			}
			// Add backup message with nonce for paused chat in 7TV and re-rendering self handlers in native chat
			if (message.nonce) {
				this.queue.addByValue({
					...message,
					queueKey: message.nonce,
				});
			}
		} else if (message.type === ChatModule.LINK_MESSAGE_ID) {
			if (!message.nonce && !message.id) return;
			const queueMessage = this.queue.getAndRemove(message.nonce);
			if (!queueMessage) return;
			if (message.id) {
				this.queue.addByValue({
					...queueMessage,
					queueKey: message.id,
				});
			}
		} else {
			this.logger.warn(`Unknown message with id: ${message.type}`, message);
		}
	}
}
