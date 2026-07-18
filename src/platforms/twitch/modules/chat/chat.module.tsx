import type { ChatType, TwitchChatMessage } from "$types/platforms/twitch/twitch.events.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import TwitchModule from "../../twitch.module.ts";

export default class ChatModule extends TwitchModule {
	static readonly TWITCHTV_CHAT_SELECTOR = ".chat-scrollable-area__message-container";
	static readonly SEVENTV_CHAT_SELECTOR = "main.seventv-chat-list";
	static readonly TWITCHTV_MESSAGE_SELECTOR = ".chat-line__message";
	static readonly SEVENTV_MESSAGE_SELECTOR = ".seventv-message[msg-id]";
	static readonly VALID_MESSAGE_TYPES_IDS = [0];

	private observer: MutationObserver | undefined;
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
		this.createObserver([
			...document.querySelectorAll(ChatModule.TWITCHTV_CHAT_SELECTOR),
			...document.querySelectorAll(ChatModule.SEVENTV_CHAT_SELECTOR),
		]);
		this.logger.info("Injected chat module");

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
		const rawMessage =
			type === "7TV" ? this.twitchUtils().getSevenTvChatMessage(element) : this.twitchUtils().getChatMessage(element);
		const wrappedMessage = (rawMessage as any)?.message;
		const normalizedMessage =
			wrappedMessage && typeof wrappedMessage === "object" ? (wrappedMessage as TwitchChatMessage) : rawMessage;
		const id = type === "7TV" ? (element.getAttribute("msg-id") ?? normalizedMessage?.id) : normalizedMessage?.id;
		if (!normalizedMessage || !id || !ChatModule.VALID_MESSAGE_TYPES_IDS.includes(normalizedMessage.type ?? 0)) return;
		const message = id === normalizedMessage.id ? normalizedMessage : { ...normalizedMessage, id };

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
}
