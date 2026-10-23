import type { FollowsHomeHelperOptions } from "$types/shared/module/follows-home.helper.types.ts";
import type { FollowsHomeMessage } from "$types/shared/components/follows-home.component.types.ts";

const CONTAINER_ID = "enhancer-follows-home";
const RETURN_ID = "enhancer-follows-home-return";
const TARGET_ATTRIBUTE = "data-enhancer-follows-home";
const STYLE_ID = "enhancer-follows-home-style";

export class FollowsHomeHelper {
	private container: HTMLDivElement | null = null;
	private frame: HTMLIFrameElement | null = null;
	private target: Element | null = null;
	private returnButton: HTMLDivElement | null = null;
	private returnTarget: Element | null = null;
	private dismissed = false;
	private returnHidden = false;
	private homeUrl: string | null = null;
	private readonly handleMessage = this.onMessage.bind(this);
	private readonly handleResize = this.resize.bind(this);

	constructor(private readonly options: FollowsHomeHelperOptions) {}

	async update(target: Element | null): Promise<void> {
		const onHome = window.location.pathname === "/";
		if (!onHome) {
			this.dismissed = false;
			this.returnHidden = false;
		}

		const enabled = this.options.isEnabled();
		if (!target || !onHome || this.dismissed || !enabled) {
			this.unmountFrame();
			this.updateReturnButton(target && onHome && enabled && this.dismissed ? target : null);
			return;
		}
		this.updateReturnButton(null);

		this.homeUrl ??= await this.options.resolveHomeUrl();
		if (!this.homeUrl) return;

		if (this.target !== target) {
			this.unmountFrame();
			this.target = target;
		}
		this.mount(target, this.homeUrl);
		this.silenceNativeVideos(target);
		this.resize();
	}

	unmount(): void {
		this.unmountFrame();
		this.updateReturnButton(null);
	}

	private unmountFrame(): void {
		window.removeEventListener("message", this.handleMessage);
		window.removeEventListener("resize", this.handleResize);
		this.target?.removeAttribute(TARGET_ATTRIBUTE);
		this.container?.remove();
		this.container = null;
		this.frame = null;
		this.target = null;
	}

	private mount(target: Element, homeUrl: string): void {
		this.ensureStyle();
		target.setAttribute(TARGET_ATTRIBUTE, "");
		if (this.container?.isConnected && this.container.parentElement === target) return;

		this.container = document.createElement("div");
		this.container.id = CONTAINER_ID;
		this.frame = document.createElement("iframe");
		const background = getComputedStyle(document.body).backgroundColor;
		this.frame.src = `${homeUrl}?host=${this.options.platform}&bg=${encodeURIComponent(background)}`;
		this.frame.style.background = background;
		this.frame.title = "Enhancer: followed streams";
		this.frame.allow = "autoplay";
		this.container.append(this.frame);
		target.prepend(this.container);

		window.addEventListener("message", this.handleMessage);
		window.addEventListener("resize", this.handleResize);
	}

	private updateReturnButton(target: Element | null): void {
		if (!target || this.returnHidden || !this.homeUrl) {
			this.returnButton?.remove();
			this.returnButton = null;
			return;
		}
		this.returnTarget = target;
		if (this.returnButton?.isConnected) return;
		this.ensureStyle();

		const wrapper = document.createElement("div");
		wrapper.id = RETURN_ID;

		const open = document.createElement("button");
		open.type = "button";
		open.className = "enhancer-return-open";
		open.textContent = "Back to Enhancer home";
		open.addEventListener("click", () => {
			this.dismissed = false;
			const returnTarget = this.returnTarget;
			this.updateReturnButton(null);
			void this.update(returnTarget);
		});

		const close = document.createElement("button");
		close.type = "button";
		close.className = "enhancer-return-close";
		close.textContent = "×";
		close.title = "Hide";
		close.setAttribute("aria-label", "Hide");
		close.addEventListener("click", () => {
			this.returnHidden = true;
			this.updateReturnButton(null);
		});

		wrapper.append(open, close);
		document.body.append(wrapper);
		this.returnButton = wrapper;
	}

	private ensureStyle(): void {
		if (document.getElementById(STYLE_ID)) return;
		const style = document.createElement("style");
		style.id = STYLE_ID;
		style.textContent = `
			[${TARGET_ATTRIBUTE}] > :not(#${CONTAINER_ID}) { display: none !important; }
			#${CONTAINER_ID} { width: 100%; }
			#${CONTAINER_ID} > iframe { display: block; width: 100%; height: 100%; border: 0; }
			@keyframes enhancer-return-in {
				from { opacity: 0; transform: translateY(16px) scale(0.96); }
				to { opacity: 1; transform: none; }
			}
			#${RETURN_ID} {
				position: fixed;
				right: 24px;
				bottom: 24px;
				z-index: 9999;
				display: flex;
				align-items: flex-start;
				font-family: Inter, Roobert, "Helvetica Neue", Helvetica, Arial, sans-serif;
				animation: enhancer-return-in 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
			}
			#${RETURN_ID} .enhancer-return-open {
				padding: 12px 20px;
				border: 0;
				border-radius: 999px;
				background: #9147ff;
				box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
				color: white;
				font: inherit;
				font-size: 14px;
				font-weight: 700;
				line-height: 1.2;
				cursor: pointer;
				transition: background 0.15s ease;
			}
			#${RETURN_ID} .enhancer-return-open:hover {
				background: #772ce8;
			}
			#${RETURN_ID} .enhancer-return-close {
				width: 22px;
				height: 22px;
				margin-left: -14px;
				margin-top: -6px;
				padding: 0;
				border: 0;
				border-radius: 50%;
				background: #18181b;
				box-shadow: 0 0 0 1px #3a3a3d;
				color: #adadb8;
				font: 700 14px/22px sans-serif;
				cursor: pointer;
				opacity: 0;
				transition: opacity 0.15s ease;
			}
			#${RETURN_ID}:hover .enhancer-return-close,
			#${RETURN_ID} .enhancer-return-close:focus-visible { opacity: 1; }
			#${RETURN_ID} .enhancer-return-close:hover { color: white; }
		`;
		document.head.append(style);
	}

	private silenceNativeVideos(target: Element): void {
		for (const video of target.querySelectorAll("video")) {
			if (this.container?.contains(video)) continue;
			video.muted = true;
			if (!video.paused) video.pause();
		}
	}

	private resize(): void {
		if (!this.container) return;
		const top = Math.max(0, this.container.getBoundingClientRect().top);
		this.container.style.height = `${Math.max(320, window.innerHeight - top)}px`;
	}

	private onMessage(event: MessageEvent<FollowsHomeMessage>): void {
		if (!this.frame || event.source !== this.frame.contentWindow) return;
		const message = event.data;
		if (message?.source !== "enhancer-follows-home") return;

		if (message.type === "show-original") {
			const target = this.target;
			this.dismissed = true;
			this.unmountFrame();
			this.updateReturnButton(target);
			return;
		}
		if (message.type === "navigate" && message.url.startsWith("https://")) this.options.navigate(message.url);
	}
}
