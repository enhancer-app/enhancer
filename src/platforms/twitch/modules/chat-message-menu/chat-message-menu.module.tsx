import type { MessageMenuOption } from "$shared/components/message-menu/message-menu.component.tsx";
import type { TwitchChatMessage, TwitchChatMessageEvent } from "$types/platforms/twitch/twitch.events.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import TwitchModule from "../../twitch.module.ts";

export default class ChatMessageMenuModule extends TwitchModule {
	private useAddActionInsteadOfSet = false;
	private readonly listenerControllers = new WeakMap<HTMLElement, AbortController>();

	readonly config: TwitchModuleConfig = {
		name: "chat-chat-message-menu",
		appliers: [
			{
				type: "event",
				key: "chat-chat-message-menu",
				event: "twitch:chatMessage",
				callback: this.handleMessage.bind(this),
			},
			{
				type: "event",
				key: "chat-use-add-instead-of-set",
				event: "twitch:settings:chatMessageMenuUseAddInsteadOfSet",
				callback: (value) => {
					this.useAddActionInsteadOfSet = value;
				},
			},
		],
		enabled: () => this.settings().chatMessageMenuEnabled,
	};

	initialize() {
		this.useAddActionInsteadOfSet = this.settings().chatMessageMenuUseAddInsteadOfSet;
	}

	private static readonly BLOCKED_TAGS = ["a", "img"];

	private async handleMessage({ message, element: _element }: TwitchChatMessageEvent) {
		if (!(await this.isModuleEnabled())) return;
		const element = _element as HTMLElement;
		this.listenerControllers.get(element)?.abort();
		const controller = new AbortController();
		this.listenerControllers.set(element, controller);
		element.addEventListener(
			"contextmenu",
			async (event) => {
				if (window.getSelection()?.toString()) return;
				const tag = (event.target as HTMLElement | null)?.tagName.toLowerCase();
				if (ChatMessageMenuModule.BLOCKED_TAGS.includes(tag || "")) return;
				event.preventDefault();
				const options = this.getOptions(message);
				if (options.length < 1) return;
				this.emitter.emit("twitch:messageMenu", {
					options,
					x: event.x,
					y: event.y,
				});
			},
			{ signal: controller.signal },
		);
	}

	private getOptions(message: TwitchChatMessage): MessageMenuOption[] {
		const text = message.message ?? message.messageBody ?? "";
		const username = `@${message.user.userDisplayName}`;

		const action = this.useAddActionInsteadOfSet ? "addChatText" : "setChatText";
		const actionPrefix = this.useAddActionInsteadOfSet ? "Add" : "Copy";
		const createChatOption = (keySuffix: string, labelPrefix: string, value: string): MessageMenuOption => ({
			key: `${this.useAddActionInsteadOfSet ? "add" : "copy"}-${keySuffix}-to-text-area`,
			label: `${labelPrefix} to text area`,
			onClick: () => {
				if (!value && keySuffix === "message") return;
				this.twitchUtils()[action](value, true);
			},
		});

		return [
			createChatOption("message", `${actionPrefix} message`, text),
			createChatOption("username", `${actionPrefix} username`, username),
		];
	}
}
