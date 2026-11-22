import TwitchModule from "$twitch/twitch.module.ts";
import type { ChatJoinLeaveAction, ChatJoinLeaveProps } from "$types/platforms/twitch/twitch.chat-join-leave.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import { render } from "preact";
import { ChatJoinLeaveComponent, formatChatJoinLeave } from "./chat-join-leave.component.tsx";

export default class ChatJoinLeaveModule extends TwitchModule {
	private static readonly IRC_URL = "wss://irc-ws.chat.twitch.tv";
	private static readonly MEMBERSHIP_LINE = /^:(\w+)!\w+@\w+\.tmi\.twitch\.tv (JOIN|PART) #(\w+)$/;
	private static readonly INFO_MESSAGE_TYPE = 29;
	private static readonly BATCH_DELAY = 1500;
	private static readonly RENDERED_ATTRIBUTE = "enhancer-chat-join-leave";

	private interceptorInstalled = false;
	private readonly membershipSockets = new WeakSet<WebSocket>();
	private readonly filteredData = new WeakMap<MessageEvent, string>();
	private readonly pending = new Map<string, ChatJoinLeaveAction>();
	private pendingChannel: string | null = null;
	private batchTimeout: ReturnType<typeof setTimeout> | null = null;
	private messageCounter = 0;

	readonly config: TwitchModuleConfig = {
		name: "chat-join-leave",
		enabled: () => this.settings().chatJoinLeaveEnabled,
		appliers: [
			{
				type: "event",
				key: "chat-join-leave-setting",
				event: "twitch:settings:chatJoinLeaveEnabled",
				callback: (enabled: boolean) => (enabled ? this.installInterceptor() : this.clearPending()),
			},
		],
	};

	initialize() {
		if (this.isModuleEnabled()) this.installInterceptor();
	}

	// Twitch's IRC client shows a welcome line for every JOIN, so membership lines are removed before it reads them.
	private installInterceptor() {
		if (this.interceptorInstalled) return;
		const descriptor = Object.getOwnPropertyDescriptor(MessageEvent.prototype, "data");
		const originalGetter = descriptor?.get;
		if (!descriptor || !originalGetter) return;

		const module = this;
		Object.defineProperty(MessageEvent.prototype, "data", {
			...descriptor,
			get(this: MessageEvent) {
				const data = originalGetter.call(this);
				const target = this.target;
				if (typeof data !== "string" || !(target instanceof WebSocket)) return data;
				if (!target.url.startsWith(ChatJoinLeaveModule.IRC_URL)) return data;
				return module.interceptIrcData(this, target, data);
			},
		});
		this.interceptorInstalled = true;
	}

	private interceptIrcData(event: MessageEvent, socket: WebSocket, data: string) {
		if (!this.membershipSockets.has(socket)) {
			if (!this.isModuleEnabled() || socket.readyState !== WebSocket.OPEN) return data;
			this.membershipSockets.add(socket);
			socket.send("CAP REQ :twitch.tv/membership");
			this.logger.info("Requested chat membership events");
			return data;
		}
		if (!data.includes(" JOIN #") && !data.includes(" PART #")) return data;

		const cached = this.filteredData.get(event);
		if (cached !== undefined) return cached;

		const controller = this.twitchUtils().getChatController();
		const channel = controller?.props.channelLogin?.toLowerCase();
		const currentUser = controller?.props.userLogin?.toLowerCase();
		const kept: string[] = [];
		for (const line of data.split("\r\n")) {
			const match = ChatJoinLeaveModule.MEMBERSHIP_LINE.exec(line);
			const login = match?.[1];
			if (!match || !login || login === currentUser || login.startsWith("justinfan")) {
				kept.push(line);
				continue;
			}
			if (channel && match[3] === channel && this.isModuleEnabled()) {
				this.queue(channel, login, match[2] === "JOIN" ? "join" : "leave");
			}
		}

		const filtered = kept.join("\r\n");
		this.filteredData.set(event, filtered);
		return filtered;
	}

	private queue(channel: string, login: string, action: ChatJoinLeaveAction) {
		if (this.pendingChannel !== channel) {
			this.clearPending();
			this.pendingChannel = channel;
		}
		// A leave and a join in the same batch is usually a page refresh, so both are dropped.
		const previous = this.pending.get(login);
		if (previous && previous !== action) this.pending.delete(login);
		else this.pending.set(login, action);

		this.batchTimeout ??= setTimeout(() => this.flush(), ChatJoinLeaveModule.BATCH_DELAY);
	}

	private clearPending() {
		if (this.batchTimeout) clearTimeout(this.batchTimeout);
		this.batchTimeout = null;
		this.pending.clear();
		this.pendingChannel = null;
	}

	private flush() {
		const channel = this.pendingChannel;
		const entries = [...this.pending];
		this.clearPending();
		const currentChannel = this.twitchUtils().getChatController()?.props.channelLogin?.toLowerCase();
		if (!this.isModuleEnabled() || channel !== currentChannel) return;

		const joined = entries.filter(([, action]) => action === "join").map(([login]) => login);
		const left = this.settings().chatJoinLeaveShowLeaves
			? entries.filter(([, action]) => action === "leave").map(([login]) => login)
			: [];
		if (joined.length || left.length) this.pushMessage(joined, left);
	}

	private pushMessage(joined: string[], left: string[]) {
		const controller = this.twitchUtils().getChatController();
		if (!controller) return;
		const props: ChatJoinLeaveProps = {
			joined,
			left,
			visibleCount: Math.max(1, this.settings().chatJoinLeaveVisibleNames),
		};
		const text = formatChatJoinLeave(props);
		controller.pushMessage({
			id: `${this.getId()}-${++this.messageCounter}`,
			type: ChatJoinLeaveModule.INFO_MESSAGE_TYPE,
			message: text,
		});
		void this.commonUtils().waitFor(
			() => this.findStatusLine(text),
			(element) => {
				element.setAttribute(ChatJoinLeaveModule.RENDERED_ATTRIBUTE, "");
				element.textContent = "";
				render(<ChatJoinLeaveComponent {...props} />, element);
				return true;
			},
			{ delay: 100, maxRetries: 20 },
		);
	}

	private findStatusLine(text: string) {
		const lines = document.querySelectorAll(`.chat-line__status:not([${ChatJoinLeaveModule.RENDERED_ATTRIBUTE}])`);
		for (let index = lines.length - 1; index >= 0; index--) {
			if (lines[index].textContent === text) return lines[index];
		}
	}
}
