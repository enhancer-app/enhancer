import type CommonUtils from "$shared/utils/common.utils.ts";
import type ReactUtils from "$shared/utils/react.utils.ts";
import type { KickChatMessageData } from "$types/platforms/kick/kick.events.types.ts";
import type { IsoDateProps, StreamStatusProps, VideoProgressProps } from "$types/platforms/kick/kick.utils.types.ts";
import type { ChannelChatRoom, ChannelChatRoomInfo, ChannelInfo } from "$types/platforms/kick/kick.utils.types.ts";
import type { KickPlayerQuality, KickQualityController } from "$types/platforms/kick/kick.utils.types.ts";

export default class KickUtils {
	constructor(
		protected readonly reactUtils: ReactUtils,
		protected readonly commonUtils: CommonUtils,
	) {}

	private static readonly FIREFOX_LIVE_VIDEO_THRESHOLD = 5_000_000_000_000;
	private static readonly PLAYER_ANCHOR_SELECTOR = "#injected-embedded-channel-player-video";
	private static readonly PLAYER_FIBER_CLIMB = 5;
	private static readonly MAX_FIBER_VISITS = 5000;
	private static readonly MAX_HOOK_VISITS = 140;
	private static readonly SET_QUALITY_MARKERS = ["ivsLivestreamPlayer", "setQuality"];
	private static readonly AUTHENTICATED_STATUS = "authenticated";
	private static readonly UNAUTHENTICATED_STATUS = "unauthenticated";
	private static readonly CHAT_STICKY_THRESHOLD = 40;

	getMessageData(messageElement: Element): KickChatMessageData | null {
		const props = this.reactUtils.findReactChildren<KickChatMessageData>(
			this.reactUtils.getReactInstance(messageElement),
			(n) => n?.pendingProps?.message,
			100,
		)?.pendingProps;

		if (!props?.message) {
			return null;
		}

		return props.message;
	}

	getChannelInfo() {
		return this.reactUtils.findReactParents<never, ChannelInfo>(
			this.reactUtils.getReactInstance(document.querySelector("main")),
			(n) => !!n?.memoizedProps?.channelId && !!n?.memoizedProps?.slug,
		)?.memoizedProps;
	}

	getIsoDateProps() {
		return this.reactUtils.findReactChildren<never, IsoDateProps>(
			this.reactUtils.getReactInstance(document.querySelector("main")),
			(n) => {
				return !!n?.memoizedProps?.isoDate;
			},
			1000,
		)?.memoizedProps;
	}

	getVideoProgressProps() {
		return this.reactUtils.findReactChildren<VideoProgressProps>(
			this.reactUtils.getReactInstance(document.querySelector("#injected-embedded-channel-player-video")),
			(n) => {
				const props = n?.memoizedProps;
				return props?.durationInMs && props?.currentProgressInMs && props?.loadedInMs;
			},
			1000,
		)?.memoizedProps;
	}

	getStreamStatusProps() {
		return this.reactUtils.findReactChildren<never, StreamStatusProps>(
			this.reactUtils.getReactInstance(document.querySelector("#injected-embedded-channel-player-video")),
			(n) => {
				const props = n?.memoizedProps;
				return props?.isLive !== undefined && props?.isPlaying !== undefined;
			},
			1000,
		)?.memoizedProps;
	}

	getChannelChatRoomInfo() {
		return this.reactUtils.findReactParents<never, ChannelChatRoomInfo>(
			this.reactUtils.getReactInstance(document.querySelector("#channel-chatroom")),
			(n) => !!n?.memoizedProps?.slug,
		)?.memoizedProps;
	}

	getChannelChatRoom() {
		return this.reactUtils.findReactChildren<never, ChannelChatRoom>(
			this.reactUtils.getReactInstance(document.querySelector("#channel-chatroom")),
			(n) => !!n?.memoizedProps?.messages && !!n?.memoizedProps?.setIsPaused,
		)?.memoizedProps;
	}

	isUsingNTV(element?: Element): boolean {
		const elementToSerach = element ?? document;
		return !!elementToSerach.querySelector(".ntv__chat-message__inner");
	}

	private getChatInput() {
		return document.querySelector("#ntv__message-input") ?? document.querySelector('div[data-testid="chat-input"]');
	}

	getChatInputContent() {
		return this.getChatInput()?.textContent;
	}

	setChatInputContent(text: string, focus?: boolean) {
		const chatInput = this.getChatInput() as HTMLElement | null;
		if (!chatInput) return;
		chatInput.innerText = text;
		chatInput.dispatchEvent(new Event("input", { bubbles: true }));
		if (focus) {
			chatInput.focus();
			const range = document.createRange();
			range.selectNodeContents(chatInput);
			range.collapse(false);
			const sel = window.getSelection();
			if (sel) {
				sel.removeAllRanges();
				sel.addRange(range);
			}
		}
	}

	isLiveVideo(video: HTMLVideoElement): boolean {
		return video.duration === Number.POSITIVE_INFINITY || video.duration > KickUtils.FIREFOX_LIVE_VIDEO_THRESHOLD;
	}

	getLatency(video: HTMLVideoElement): number | undefined {
		const { currentTime, buffered } = video;
		if (buffered.length === 0) return undefined;
		const bufferEnd = buffered.end(buffered.length - 1);

		return bufferEnd - currentTime;
	}

	private chatScroller: { container: HTMLElement; sticky: boolean } | undefined;

	scrollToBottomOnChat() {
		const scroller = this.resolveChatScroller();
		if (!scroller?.sticky) return;
		scroller.container.scrollTop = scroller.container.scrollHeight;
	}

	private resolveChatScroller() {
		if (this.chatScroller?.container.isConnected) return this.chatScroller;
		const container = this.findChatScrollContainer();
		if (!container) return undefined;
		const scroller = { container, sticky: KickUtils.isAtBottom(container) };
		container.addEventListener(
			"scroll",
			() => {
				scroller.sticky = KickUtils.isAtBottom(container);
			},
			{ passive: true },
		);
		this.chatScroller = scroller;
		return scroller;
	}

	private static isAtBottom(container: HTMLElement) {
		return container.scrollHeight - container.scrollTop - container.clientHeight <= KickUtils.CHAT_STICKY_THRESHOLD;
	}

	private findChatScrollContainer(): HTMLElement | undefined {
		const message = document.querySelector("#channel-chatroom div[data-index]");
		let node: HTMLElement | null = message?.parentElement ?? null;
		while (node && node !== document.body) {
			const overflowY = getComputedStyle(node).overflowY;
			if (overflowY === "auto" || overflowY === "scroll") return node;
			node = node.parentElement;
		}
		const chatRoom = document.querySelector("#channel-chatroom");
		if (!chatRoom) return undefined;
		for (const candidate of chatRoom.querySelectorAll<HTMLElement>("*")) {
			const overflowY = getComputedStyle(candidate).overflowY;
			if ((overflowY === "auto" || overflowY === "scroll") && candidate.scrollHeight > candidate.clientHeight) {
				return candidate;
			}
		}
		return undefined;
	}

	getQualityController(): KickQualityController | null {
		return this.searchPlayerFibers((fiber) => this.readQualityController(fiber));
	}

	isViewerAuthenticated(): boolean | null {
		const authStatus = this.searchPlayerFibers((fiber) => this.readSessionAuthStatus(fiber));
		if (authStatus === KickUtils.AUTHENTICATED_STATUS) return true;
		if (authStatus === KickUtils.UNAUTHENTICATED_STATUS) return false;
		return null;
	}

	private getPlayerFiberRoot() {
		const element = document.querySelector(KickUtils.PLAYER_ANCHOR_SELECTOR);
		if (!element) return null;
		let fiber = this.reactUtils.getReactInstance(element);
		for (let climb = 0; climb < KickUtils.PLAYER_FIBER_CLIMB && fiber?.return; climb++) {
			fiber = fiber.return;
		}
		return fiber ?? null;
	}

	private searchPlayerFibers<T>(read: (fiber: any) => T | null): T | null {
		const root = this.getPlayerFiberRoot();
		if (!root) return null;

		const queue: any[] = [root];
		let visits = 0;
		while (queue.length > 0 && visits < KickUtils.MAX_FIBER_VISITS) {
			const fiber = queue.shift();
			visits++;
			const result = read(fiber);
			if (result) return result;
			if (fiber.child) queue.push(fiber.child);
			if (fiber.sibling) queue.push(fiber.sibling);
		}

		return null;
	}

	private readQualityController(fiber: any): KickQualityController | null {
		let hook = fiber?.memoizedState;
		let qualities: KickPlayerQuality[] | null = null;
		let setQuality: KickQualityController["setQuality"] | null = null;

		let visits = 0;
		while (hook && visits < KickUtils.MAX_HOOK_VISITS) {
			const state = hook.memoizedState;
			if (this.isQualityList(state)) qualities = state;
			else if (this.isSetQuality(state)) setQuality = state;
			hook = hook.next;
			visits++;
		}

		if (!qualities || !setQuality) return null;
		return { qualities, setQuality };
	}

	private isQualityList(state: unknown): state is KickPlayerQuality[] {
		return (
			Array.isArray(state) &&
			state.length > 1 &&
			state.every((entry) => !!entry && typeof entry === "object" && "variantSource" in entry)
		);
	}

	private isSetQuality(state: unknown): state is KickQualityController["setQuality"] {
		if (typeof state !== "function") return false;
		const source = state.toString();
		return KickUtils.SET_QUALITY_MARKERS.every((marker) => source.includes(marker));
	}

	private readSessionAuthStatus(fiber: any): string | null {
		let hook = fiber?.memoizedState;
		let visits = 0;
		while (hook && visits < KickUtils.MAX_HOOK_VISITS) {
			const tag = hook.memoizedState?.tag;
			if (tag?.type === "session" && typeof tag.authStatus === "string") return tag.authStatus;
			hook = hook.next;
			visits++;
		}
		return null;
	}
}
