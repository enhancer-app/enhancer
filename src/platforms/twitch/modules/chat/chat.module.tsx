import QueueFactory from "$shared/queue/queue-factory.ts";
import type { ChatType, TwitchChatMessage } from "$types/platforms/twitch/twitch.events.types.ts";
import type { ChatControllerComponent } from "$types/platforms/twitch/twitch.utils.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import type { QueueValue } from "$types/shared/queue.types.ts";
import TwitchModule from "../../twitch.module.ts";

export default class ChatModule extends TwitchModule {
	static readonly TWITCHTV_CHAT_SELECTOR = ".chat-scrollable-area__message-container";
	static readonly SEVENTV_CHAT_SELECTOR = "main.seventv-chat-list";
	static readonly SEVENTV_NATIVE_CHAT_SELECTOR = "seventv-container.seventv-chat-list";
	static readonly TWITCHTV_MESSAGE_SELECTOR = ".chat-line__message";
	static readonly SEVENTV_MESSAGE_SELECTOR = ".seventv-message[msg-id]";
	static readonly VALID_MESSAGE_TYPES_IDS = [0];
	static readonly LINK_MESSAGE_ID = 51;

	private observer: MutationObserver | undefined;
	private messageHandlerApi: ChatControllerComponent["props"]["messageHandlerAPI"] | undefined;
	private messageHandler: ((message: TwitchChatMessage) => void) | undefined;
	private readonly sevenTvMessageQueue = new QueueFactory<TwitchChatMessage & QueueValue>().create({ expire: 300 });

	readonly config: TwitchModuleConfig = {
		name: "chat",
		appliers: [
			{
				type: "selector",
				key: "chat",
				selectors: [
					ChatModule.TWITCHTV_CHAT_SELECTOR,
					ChatModule.SEVENTV_CHAT_SELECTOR,
					ChatModule.SEVENTV_NATIVE_CHAT_SELECTOR,
				],
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
			const joined = await this.enhancerApi().joinChannel(channelId);
			if (joined) {
				this.emitter.emit("extension:joined-channel");
				this.logger.info(`Joined channel ${channelId}`);
			}
		} catch (error) {
			this.logger.error("Failed to join channel", error);
		}
	}

	private run(elements: Element[]) {
		if (elements.length > 1) this.logger.warn("Found multiple chat elements");
		this.subscribeToSevenTvMessages();
		this.createObserver([
			...document.querySelectorAll(ChatModule.TWITCHTV_CHAT_SELECTOR),
			...document.querySelectorAll(ChatModule.SEVENTV_CHAT_SELECTOR),
			...document.querySelectorAll(ChatModule.SEVENTV_NATIVE_CHAT_SELECTOR),
		]);
		this.logger.info("Injected chat module");

		this.broadcastInitializeChannel();
	}

	async broadcastInitializeChannel() {
		await this.commonUtils()
			.waitFor<ChatControllerComponent>(
				() => {
					const controller = this.twitchUtils().getChatController();
					return controller?.props.channelID && controller.props.messageHandlerAPI ? controller : undefined;
				},
				(controller, attempt) => {
					this.subscribeToSevenTvMessages(controller.props.messageHandlerAPI);
					this.emitter.emit("twitch:chatInitialized", controller.props.channelID);
					this.logger.info(`Initialized chat (attempt: ${attempt})`);
					return true;
				},
				{ delay: 100, maxRetries: 20, initialDelay: 30 },
			)
			.catch(() => this.logger.warn("Failed to detect channelID for chat initialization after 20 attempts."));
	}

	private createObserver(elements: Element[]) {
		this.observer?.disconnect();
		this.observer = new MutationObserver((list) => {
			for (const mutation of list) {
				if (mutation.type === "attributes") this.handleAddedNode(mutation.target);
				for (const node of mutation.addedNodes) this.handleAddedNode(node);
			}
		});
		elements.forEach((element) =>
			this.observer?.observe(element, {
				attributes: true,
				attributeFilter: ["msg-id"],
				childList: true,
				subtree: true,
			}),
		);
		elements.forEach((element) => this.handleAddedNode(element, true));
	}

	private handleAddedNode(node: Node, isReplay = false) {
		if (!(node instanceof Element)) return;
		this.handleMessages(node, ChatModule.TWITCHTV_MESSAGE_SELECTOR, "TWITCH", isReplay);
		this.handleMessages(node, ChatModule.SEVENTV_MESSAGE_SELECTOR, "7TV", isReplay);
	}

	private handleMessages(node: Element, selector: string, type: ChatType, isReplay: boolean) {
		const elements = new Set<Element>();
		const parentMessage = node.closest(selector);
		if (parentMessage) elements.add(parentMessage);
		if (node.matches(selector)) elements.add(node);
		node.querySelectorAll(selector).forEach((element) => elements.add(element));
		elements.forEach((element) => this.handleMessage(element, type, isReplay));
	}

	private handleMessage(element: Element, type: ChatType, isReplay: boolean) {
		const message = type === "7TV" ? this.getSevenTvMessage(element) : this.twitchUtils().getChatMessage(element);
		if (!message?.id || !ChatModule.VALID_MESSAGE_TYPES_IDS.includes(message.type ?? 0)) return;
		if (type === "TWITCH" && document.querySelector(ChatModule.SEVENTV_CHAT_SELECTOR)) {
			const sevenTvElement = this.findSevenTvMessageElement(message.id);
			if (sevenTvElement) this.handleMessage(sevenTvElement, "7TV", isReplay);
			return;
		}

		const marker = `${type}:${message.nonce || message.id}`;
		if (element.getAttribute("enhancer-message-handled") === marker) return;
		element.setAttribute("enhancer-message-handled", marker);
		this.emitter.emit("twitch:chatMessage", {
			element,
			message: { ...message, createdAt: message.createdAt ?? Date.now() },
			type,
			isReplay,
		});
	}

	private subscribeToSevenTvMessages(
		messageHandlerApi = this.twitchUtils().getChatController()?.props.messageHandlerAPI,
	) {
		if (!document.querySelector(ChatModule.SEVENTV_CHAT_SELECTOR)) return;
		if (!messageHandlerApi || messageHandlerApi === this.messageHandlerApi) return;
		if (this.messageHandler) this.messageHandlerApi?.removeMessageHandler?.(this.messageHandler);
		this.messageHandlerApi = messageHandlerApi;
		this.messageHandler = (message) => {
			if (this.messageHandlerApi !== messageHandlerApi) return;
			this.bufferSevenTvMessage(message);
		};
		messageHandlerApi.addMessageHandler(this.messageHandler);
	}

	private bufferSevenTvMessage(rawMessage: TwitchChatMessage) {
		const wrappedMessage = (rawMessage as any).message;
		const isWrappedMessage =
			wrappedMessage && typeof wrappedMessage === "object" && "id" in wrappedMessage && "user" in wrappedMessage;
		const message = isWrappedMessage ? (wrappedMessage as TwitchChatMessage) : rawMessage;
		const createdAt = Date.now();

		if (ChatModule.VALID_MESSAGE_TYPES_IDS.includes(message.type) || isWrappedMessage) {
			if (message.nonce) {
				this.sevenTvMessageQueue.addByValue({ ...message, createdAt, queueKey: message.nonce });
			}
			if (message.id) {
				this.sevenTvMessageQueue.addByValue({ ...message, createdAt, queueKey: message.id });
				this.processSevenTvMessage(message.id);
			}
			return;
		}

		if (message.type !== ChatModule.LINK_MESSAGE_ID || (!message.nonce && !message.id)) return;
		const queuedMessage = this.sevenTvMessageQueue.getAndRemove(message.nonce);
		if (!queuedMessage || !message.id) return;
		this.sevenTvMessageQueue.addByValue({ ...queuedMessage, id: message.id, queueKey: message.id });
		this.processSevenTvMessage(message.id);
	}

	private processSevenTvMessage(id: string) {
		const element = this.findSevenTvMessageElement(id);
		if (element) this.handleMessage(element, "7TV", false);
	}

	private findSevenTvMessageElement(id: string) {
		return document.querySelector(`${ChatModule.SEVENTV_MESSAGE_SELECTOR}[msg-id="${CSS.escape(id)}"]`);
	}

	private getSevenTvMessage(element: Element) {
		const id = element.getAttribute("msg-id");
		if (!id) return;
		const queuedMessage = this.sevenTvMessageQueue.getAndRemove(id);
		if (queuedMessage) {
			if (queuedMessage.nonce) this.sevenTvMessageQueue.remove(queuedMessage.nonce);
			return queuedMessage;
		}

		for (const nativeElement of document.querySelectorAll(ChatModule.TWITCHTV_MESSAGE_SELECTOR)) {
			const message = this.twitchUtils().getChatMessage(nativeElement);
			if (message?.id === id) return message;
		}
	}
}
