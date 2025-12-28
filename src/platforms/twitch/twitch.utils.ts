import type ReactUtils from "$shared/utils/react.utils.ts";
import type {
	ChannelInfo,
	ChannelInfoAlternativeComponent,
	ChannelInfoComponent,
	Chat,
	ChatCommandStoreComponent,
	ChatControllerComponent,
	ChatInfoComponent,
	ChatInputComponent,
	CurrentLiveStatusComponent,
	FollowedSectionComponenet,
	MediaPlayerComponent,
	PersistentPlayerComponent,
	RootComponent,
	ScrollableChatComponent,
	StreamInfoTwitchStreamData,
	TwitchChatCommand,
	TwitchChatMessageComponent,
} from "$types/platforms/twitch/twitch.utils.types";

export default class TwitchUtils {
	constructor(protected readonly reactUtils: ReactUtils) {}

	getCurrentChannelByUrl() {
		let url = window.location.href;
		url = url.replace(/(^\w+:|^)\/\//, "");
		const elements = url.split("/");
		let name = elements[1];
		if (name === "popout" || elements[0].includes("dashboard")) name = elements[2];
		if (name === "moderator" || elements[0].includes("dashboard")) name = elements[2];
		if (name.includes("?")) name = name.substring(0, name.indexOf("?"));
		if (name.endsWith("#")) name = name.substring(0, name.indexOf("#"));
		return name.toLowerCase();
	}

	getCurrentChannelFromDirectTwitchPlayer() {
		if (!this.isDirectTwitchPlayer()) return;
		const url = new URL(window.location.href);
		return url.searchParams.get("channel");
	}

	isDirectTwitchPlayer() {
		return window.location.href.includes("player.twitch.tv");
	}

	isModeratorView() {
		return window.location.href.includes("/moderator/");
	}

	getUserIdBySideElement(element: Element): string | undefined {
		return this.reactUtils.findReactChildren<number>(
			this.reactUtils.getReactInstance(element),
			(n) => !!n.pendingProps?.userID,
			20,
		)?.pendingProps?.userID;
	}

	getMediaPlayerInstance() {
		return this.reactUtils.findReactChildren<MediaPlayerComponent>(
			this.reactUtils.getReactInstance(document.querySelector(".persistent-player")),
			(n) => !!n.stateNode?.props?.mediaPlayerInstance,
			200,
		)?.stateNode.props.mediaPlayerInstance;
	}

	getMediaPlayerComponent() {
		return this.reactUtils.findReactChildren<MediaPlayerComponent>(
			this.reactUtils.getReactInstance(document.querySelector(".persistent-player")),
			(n) => !!n.stateNode?.props?.mediaPlayerInstance,
			200,
		)?.stateNode.props;
	}

	getPersonalSections() {
		return this.reactUtils.findReactParents<FollowedSectionComponenet>(
			this.reactUtils.getReactInstance(document.querySelector(".side-nav-section")),
			(n) => !!n.stateNode?.props?.section,
			100,
		)?.stateNode;
	}

	getPersistentPlayer() {
		return this.reactUtils.findReactChildren<PersistentPlayerComponent>(
			this.reactUtils.getReactInstance(document.querySelector(".persistent-player")),
			(n) => !!n.stateNode?.props?.content.channelLogin,
		)?.stateNode.props;
	}

	getChatCommandStore() {
		const node = this.reactUtils.findReactParents<never, never, ChatCommandStoreComponent>(
			this.reactUtils.getReactInstance(document.querySelector(".stream-chat")),
			(n) => n.pendingProps?.value?.getCommands != null,
			25,
		);
		return node?.pendingProps.value;
	}

	getChat() {
		const node = this.reactUtils.findReactChildren<Chat>(
			this.reactUtils.getReactInstance(document.querySelector(".stream-chat")),
			(n) => n.stateNode?.props?.onSendMessage,
			190,
		);
		return node?.stateNode;
	}

	getChatController() {
		const node = this.reactUtils.findReactParents<ChatControllerComponent>(
			this.reactUtils.getReactInstance(
				document.querySelector('section[data-test-selector="chat-room-component-layout"]'),
			),
			(n) => n.stateNode?.props?.chatConnectionAPI,
			50,
		);
		return node?.stateNode;
	}

	addCommandToChat(command: TwitchChatCommand) {
		const commandStore = this.getChatCommandStore();
		if (!commandStore) return;
		commandStore.addCommand({ ...command, group: "Enhancer" });
	}

	getChatInputContent(): string | null {
		const chatInputElement = document.querySelector(
			'span[data-a-target="chat-input-text"]',
		) as HTMLTextAreaElement | null;

		if (chatInputElement) {
			return chatInputElement.textContent;
		}
		return null;
	}

	getChannelId(): string {
		return this.reactUtils.findReactChildren(
			this.reactUtils.getReactInstance(document.querySelector(".channel-info-content")),
			(n) => n.stateNode?.props?.channelID,
			1000,
		)?.pendingProps.channelID;
	}

	getChatMessage(message: Node | Element | HTMLElement | null) {
		if (!message) return;
		return this.reactUtils.findReactChildren<TwitchChatMessageComponent>(
			this.reactUtils.getReactInstance(message),
			(n) => n.return?.stateNode?.props?.message,
			10,
		)?.return.stateNode.props as TwitchChatMessageComponent;
	}

	getAutoCompleteHandler() {
		return this.reactUtils.findReactChildren<ChatInputComponent>(
			this.reactUtils.getReactInstance(document.querySelector(".chat-input__textarea")),
			(n) => n.stateNode?.providers,
			100,
		)?.stateNode;
	}

	setChatText(message: string, focus?: boolean) {
		const chatInput = this.getAutoCompleteHandler();
		chatInput?.componentRef.props.onChange({ target: { value: message } });
		if (focus) chatInput?.componentRef.focus();
	}

	addChatText(message: string, focus?: boolean) {
		const chatInput = this.getAutoCompleteHandler();
		if (!chatInput) return;
		const fullMessage = `${chatInput.state.value} ${message}`;
		chatInput.componentRef.props.onChange({ target: { value: fullMessage } });
		if (focus) chatInput?.componentRef.focus();
	}

	addTextToChatInput(message: string) {
		const value = this.getAutoCompleteHandler()?.state.value || "";
		this.setChatText(this.format(message, value), true);
	}

	format(text: string, value: string): string {
		const formattedText = !value.endsWith(" ") && value.length > 0 ? ` ${text}` : text;
		return `${value}${formattedText}`;
	}

	getScrollableChat() {
		const element = document.querySelector('section[data-test-selector="chat-room-component-layout"]');
		if (!element) return;
		const props = this.reactUtils.findReactChildren<ScrollableChatComponent>(
			this.reactUtils.getReactInstance(element),
			(n) => n?.stateNode?.props?.setPaused && n?.stateNode?.props?.messagesHash,
			100,
		)?.stateNode.props;
		if (!props) return;
		return { element, props };
	}

	unstuckScroll() {
		const nativeChat = this.getScrollableChat();
		const sevenTvChat = document.querySelector(".scrollable-contents");
		if (!nativeChat && !sevenTvChat) return;

		const isNativePaused = nativeChat?.element?.classList.contains("chat-scrollable-area__message-container--paused");
		const isSevenTvPaused = sevenTvChat?.querySelector(".seventv-message-buffer-notice")?.textContent === "Chat Paused";
		if (isNativePaused || isSevenTvPaused) return;

		if (sevenTvChat) {
			sevenTvChat.scrollTop = sevenTvChat.scrollHeight;
		} else if (nativeChat) {
			nativeChat.props.setPaused(true);
			nativeChat.props.setPaused(false);
		}
	}

	getVideoIdFromLink(link: string) {
		if (!URL.canParse(link)) return;
		const params = link.split("/");
		const videoIndex = params.findIndex((item) => item === "videos" || item === "video");
		if (videoIndex === -1) return;
		let id = params[videoIndex + 1];
		if (id.includes("?")) id = id.substring(0, id.lastIndexOf("?"));
		return id;
	}

	getChatInfo() {
		return this.reactUtils.findReactChildren<ChatInfoComponent>(
			this.reactUtils.getReactInstance(document.querySelector(".chat-list--default")),
			(n) => n.stateNode?.props?.sharedChatDataByChannelID,
			100,
		)?.stateNode;
	}

	getCurrentLiveStatus() {
		return this.reactUtils.findReactChildren<CurrentLiveStatusComponent>(
			this.reactUtils.getReactInstance(document.querySelector(".video-player__default-player")),
			(n) =>
				n?.stateNode?.props.isOffline !== undefined &&
				n?.stateNode?.props.isPlaying !== undefined &&
				n?.stateNode?.props.liveContentChannelLogin,
			100,
		)?.stateNode.props;
	}

	getChannelInfo(): ChannelInfo | undefined {
		const props = this.reactUtils.findReactChildren<ChannelInfoComponent>(
			this.reactUtils.getReactInstance(document.querySelector("#live-channel-stream-information")),
			(n) => n?.stateNode?.props.channelLogin !== undefined && n?.stateNode?.props.channelName !== undefined,
			100,
		)?.stateNode.props;
		if (!props) return;
		return { displayName: props.channelName, channelLogin: props.channelLogin };
	}

	getChannelInfoFromHomeLowerContent(): ChannelInfo | undefined {
		const props = this.reactUtils.findReactChildren<ChannelInfoAlternativeComponent>(
			this.reactUtils.getReactInstance(document.querySelector(".home__lower-content")),
			(n) => n?.stateNode?.props.channelID !== undefined && n?.stateNode?.props.channelLogin !== undefined,
			100,
		)?.stateNode.props;
		if (!props) return;
		return { displayName: props.displayName, channelLogin: props.channelLogin, channelId: props.channelID };
	}

	getApolloClient() {
		const reactRoot = this.reactUtils.getReactRoot(document.querySelector("#root"));
		return this.reactUtils.findReactChildren<never, never, RootComponent>(
			reactRoot?._internalRoot?.current ?? reactRoot,
			(n) => n.pendingProps?.value?.client,
			100,
		)?.pendingProps.value.client;
	}

	getStreamInfo() {
		const props = this.reactUtils.findReactChildren<never, never, StreamInfoTwitchStreamData>(
			this.reactUtils.getReactInstance(document.querySelector("#live-channel-stream-information")),
			(n) =>
				(n?.pendingProps?.costreamDetails !== undefined && n?.pendingProps?.costreamViewCount !== undefined) ||
				n?.pendingProps?.guestStarGuests !== undefined,
			100,
		)?.pendingProps;
		if (!props) return;
		return props;
	}
}
