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
		this.logSevenTvDebug("setup", {
			matchedRoots: elements.length,
			nativeRoots: document.querySelectorAll(ChatModule.TWITCHTV_CHAT_SELECTOR).length,
			sevenTvRoots: document.querySelectorAll(ChatModule.SEVENTV_CHAT_SELECTOR).length,
			sevenTvNativeRoots: document.querySelectorAll(ChatModule.SEVENTV_NATIVE_CHAT_SELECTOR).length,
			sevenTvRows: document.querySelectorAll(ChatModule.SEVENTV_MESSAGE_SELECTOR).length,
		});
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
		this.logSevenTvDebug("observer-started", {
			roots: elements.map((element) => ({
				className: element.className,
				tagName: element.tagName,
			})),
		});
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
		if (type === "7TV") {
			for (const element of elements) {
				this.logSevenTvDebug("dom-row", {
					isReplay,
					marker: element.getAttribute("enhancer-message-handled"),
					messageId: element.getAttribute("msg-id"),
				});
			}
		}
		elements.forEach((element) => this.handleMessage(element, type, isReplay));
	}

	private handleMessage(element: Element, type: ChatType, isReplay: boolean) {
		const message = type === "7TV" ? this.getSevenTvMessage(element) : this.twitchUtils().getChatMessage(element);
		if (!message?.id) {
			if (type === "7TV") {
				this.logSevenTvDebug("message-rejected", {
					messageId: element.getAttribute("msg-id"),
					reason: "model-not-found",
				});
			}
			return;
		}
		if (!ChatModule.VALID_MESSAGE_TYPES_IDS.includes(message.type ?? 0)) {
			if (type === "7TV") {
				this.logSevenTvDebug("message-rejected", {
					messageId: message.id,
					reason: "invalid-type",
					type: message.type,
				});
			}
			return;
		}
		if (type === "TWITCH" && document.querySelector(ChatModule.SEVENTV_CHAT_SELECTOR)) {
			const sevenTvElement = this.findSevenTvMessageElement(message.id);
			if (sevenTvElement) this.handleMessage(sevenTvElement, "7TV", isReplay);
			return;
		}

		const marker = `${type}:${message.nonce || message.id}`;
		if (element.getAttribute("enhancer-message-handled") === marker) {
			if (type === "7TV") this.logSevenTvDebug("message-skipped", { marker, reason: "duplicate" });
			return;
		}
		element.setAttribute("enhancer-message-handled", marker);
		if (type === "7TV") {
			this.logSevenTvDebug("emit", {
				isReplay,
				marker,
				messageId: message.id,
				userId: message.user.userID,
			});
		}
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
		if (!document.querySelector(ChatModule.SEVENTV_CHAT_SELECTOR)) {
			this.logSevenTvDebug("api-subscribe-skipped", { reason: "7tv-root-missing" });
			return;
		}
		if (!messageHandlerApi) {
			this.logSevenTvDebug("api-subscribe-skipped", { reason: "api-missing" });
			return;
		}
		if (messageHandlerApi === this.messageHandlerApi) {
			this.logSevenTvDebug("api-subscribe-skipped", { reason: "already-subscribed" });
			return;
		}
		if (this.messageHandler) this.messageHandlerApi?.removeMessageHandler?.(this.messageHandler);
		this.messageHandlerApi = messageHandlerApi;
		this.messageHandler = (message) => {
			if (this.messageHandlerApi !== messageHandlerApi) {
				this.logSevenTvDebug("api-message-skipped", { reason: "stale-api" });
				return;
			}
			const wrappedMessage = (message as any).message;
			this.logSevenTvDebug("api-message", {
				id: message.id,
				nonce: message.nonce,
				type: message.type,
				wrappedId: typeof wrappedMessage === "object" ? wrappedMessage?.id : undefined,
			});
			this.bufferSevenTvMessage(message);
		};
		messageHandlerApi.addMessageHandler(this.messageHandler);
		const descriptor = Object.getOwnPropertyDescriptor(messageHandlerApi, "handleMessage");
		this.logSevenTvDebug("api-subscribed", {
			handleMessage: descriptor
				? {
						configurable: descriptor.configurable,
						enumerable: descriptor.enumerable,
						hasGetter: typeof descriptor.get === "function",
						hasSetter: typeof descriptor.set === "function",
						valueType: typeof descriptor.value,
					}
				: null,
			hasAddMessageHandler: typeof messageHandlerApi.addMessageHandler === "function",
			hasRemoveMessageHandler: typeof messageHandlerApi.removeMessageHandler === "function",
			keys: Object.keys(messageHandlerApi),
		});
	}

	private bufferSevenTvMessage(rawMessage: TwitchChatMessage) {
		const wrappedMessage = (rawMessage as any).message;
		const isWrappedMessage =
			wrappedMessage && typeof wrappedMessage === "object" && "id" in wrappedMessage && "user" in wrappedMessage;
		const message = isWrappedMessage ? (wrappedMessage as TwitchChatMessage) : rawMessage;
		const createdAt = Date.now();
		this.logSevenTvDebug("buffer-message", {
			id: message.id,
			isWrappedMessage: !!isWrappedMessage,
			nonce: message.nonce,
			type: message.type,
		});

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
		if (!queuedMessage || !message.id) {
			this.logSevenTvDebug("link-message-rejected", {
				finalId: message.id,
				nonce: message.nonce,
				reason: queuedMessage ? "final-id-missing" : "nonce-not-found",
			});
			return;
		}
		this.sevenTvMessageQueue.addByValue({ ...queuedMessage, id: message.id, queueKey: message.id });
		this.logSevenTvDebug("link-message-finalized", { finalId: message.id, nonce: message.nonce });
		this.processSevenTvMessage(message.id);
	}

	private processSevenTvMessage(id: string) {
		const element = this.findSevenTvMessageElement(id);
		this.logSevenTvDebug("process-buffered-message", { domRowFound: !!element, messageId: id });
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
			this.logSevenTvDebug("resolve", { messageId: id, source: "queue" });
			return queuedMessage;
		}

		const nativeElements = document.querySelectorAll(ChatModule.TWITCHTV_MESSAGE_SELECTOR);
		for (const nativeElement of nativeElements) {
			const message = this.twitchUtils().getChatMessage(nativeElement);
			if (message?.id === id) {
				this.logSevenTvDebug("resolve", { messageId: id, source: "native-dom" });
				return message;
			}
		}
		this.logSevenTvDebug("resolve", { messageId: id, nativeRows: nativeElements.length, source: "miss" });
	}

	private logSevenTvDebug(stage: string, data: Record<string, unknown>) {
		if (typeof localStorage !== "undefined" && localStorage.getItem("enhancer:debug:7tv") === "1") {
			this.logger.info(`[7TV] ${stage}`, data);
		}
	}
}
