import {
	MarkPopupCompact,
	MarkPopupContent,
	MarkPopupTitle,
} from "$shared/components/mark-card/mark-card.component.tsx";
import { MarksController } from "$shared/marks/marks-controller.ts";
import TwitchModule from "$twitch/twitch.module.ts";
import type { EnhancerMessageEvent } from "$types/apis/enhancer.apis.ts";
import type { TwitchChatMessageEvent } from "$types/platforms/twitch/twitch.events.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import { effect } from "@preact/signals";

export default class MarksModule extends TwitchModule {
	private static readonly POPUP_ID = "mark";

	private controller: MarksController | null = null;
	private popupMarkId: string | null = null;

	readonly config: TwitchModuleConfig = {
		name: "marks",
		appliers: [
			{
				type: "selector",
				key: "marks-chat-list",
				selectors: [".chat-list--default", "seventv-container.seventv-chat-list"],
				callback: this.handleChatList.bind(this),
				once: true,
			},
			{
				type: "event",
				key: "marks-channel",
				event: "twitch:chatInitialized",
				callback: this.handleChannel.bind(this),
			},
			{
				type: "event",
				key: "marks-joined",
				event: "extension:joined-channel",
				callback: this.handleJoinedChannel.bind(this),
			},
			{
				type: "event",
				key: "marks-message",
				event: "extension:enhancer-api-message",
				callback: this.handleApiMessage.bind(this),
			},
			{
				type: "event",
				key: "marks-chat",
				event: "twitch:chatMessage",
				callback: this.handleChatMessage.bind(this),
			},
			{
				type: "event",
				key: "marks-settings",
				event: "twitch:settings:marksEnabled",
				callback: this.handleSettingsToggle.bind(this),
			},
		],
		enabled: () => this.settings().marksEnabled,
	};

	async initialize() {
		const controller = new MarksController({
			platform: "twitch",
			workerService: this.workerService(),
			loadDismissed: async () => (await this.localStorage().get("marksDismissed")) ?? [],
			saveDismissed: (ids) => this.localStorage().save("marksDismissed", ids),
			resolveOwnLogin: async () => this.twitchUtils().getOwnLogin() ?? null,
			insertCommand: (command) => this.twitchUtils().setChatText(command, true),
		});
		this.controller = controller;
		controller.start();
		effect(() => {
			const markId = controller.mark.value?.id ?? null;
			queueMicrotask(() => this.syncPopup(markId));
		});
	}

	private syncPopup(markId: string | null) {
		const controller = this.controller;
		if (!controller) return;
		if (!markId) {
			if (this.popupMarkId) this.emitter.emit("twitch:chatPopupClose", MarksModule.POPUP_ID);
			this.popupMarkId = null;
			return;
		}
		if (this.popupMarkId === markId && this.isPopupMounted()) return;
		this.popupMarkId = markId;
		this.emitter.emit("twitch:chatPopupMessage", {
			id: MarksModule.POPUP_ID,
			title: <MarkPopupTitle controller={controller} />,
			content: <MarkPopupContent controller={controller} />,
			compactContent: (expand) => <MarkPopupCompact controller={controller} expand={expand} />,
			autoclose: controller.autoCloseSeconds,
			appearance: "card",
			progress: controller.timeProgress,
			onClose: () => {
				this.popupMarkId = null;
				controller.onDismiss();
			},
		});
	}

	private isPopupMounted(): boolean {
		return document.querySelector(`[data-popup-id="${MarksModule.POPUP_ID}"]`) !== null;
	}

	private handleChatList() {
		if (!this.controller || !this.isModuleEnabled()) return;
		void this.syncChannel();
		this.syncPopup(this.controller.mark.value?.id ?? null);
	}

	private async syncChannel() {
		await this.commonUtils().waitFor(
			() => this.twitchUtils().getChatController()?.props.channelID,
			(channelId) => {
				this.handleChannel(channelId);
				return true;
			},
			{ delay: 500, maxRetries: 20 },
		);
	}

	private handleChannel(channelId: string) {
		if (!this.isModuleEnabled()) return;
		this.controller?.setChannel(channelId);
	}

	private handleJoinedChannel() {
		const channelId = this.twitchUtils().getChatController()?.props.channelID;
		if (channelId) this.handleChannel(channelId);
	}

	private handleApiMessage(message: EnhancerMessageEvent) {
		if (!this.isModuleEnabled()) return;
		this.controller?.handleApiMessage(message.name, message.data);
	}

	private handleChatMessage({ message }: TwitchChatMessageEvent) {
		if (!this.isModuleEnabled()) return;
		const ownLogin = this.twitchUtils().getOwnLogin();
		if (!ownLogin || message.user.userLogin.toLowerCase() !== ownLogin) return;
		this.controller?.handleOwnChatMessage(message.message ?? message.messageBody ?? "", ownLogin);
	}

	private handleSettingsToggle(enabled: boolean) {
		this.controller?.setEnabled(enabled);
		if (enabled) void this.syncChannel();
	}
}
