import {
	MomentPopupCompact,
	MomentPopupContent,
	MomentPopupTitle,
} from "$shared/components/moment-card/moment-card.component.tsx";
import { MomentsController } from "$shared/moments/moments-controller.ts";
import TwitchModule from "$twitch/twitch.module.ts";
import type { EnhancerMessageEvent } from "$types/apis/enhancer.apis.ts";
import type { TwitchChatMessageEvent } from "$types/platforms/twitch/twitch.events.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import { effect } from "@preact/signals";

export default class MomentsModule extends TwitchModule {
	private static readonly POPUP_ID = "moment";

	private controller: MomentsController | null = null;
	private popupMomentId: string | null = null;

	readonly config: TwitchModuleConfig = {
		name: "moments",
		appliers: [
			{
				type: "selector",
				key: "moments-chat-list",
				selectors: [".chat-list--default", "seventv-container.seventv-chat-list"],
				callback: this.handleChatList.bind(this),
				once: true,
			},
			{
				type: "event",
				key: "moments-channel",
				event: "twitch:chatInitialized",
				callback: this.handleChannel.bind(this),
			},
			{
				type: "event",
				key: "moments-joined",
				event: "extension:joined-channel",
				callback: this.handleJoinedChannel.bind(this),
			},
			{
				type: "event",
				key: "moments-message",
				event: "extension:enhancer-api-message",
				callback: this.handleApiMessage.bind(this),
			},
			{
				type: "event",
				key: "moments-chat",
				event: "twitch:chatMessage",
				callback: this.handleChatMessage.bind(this),
			},
			{
				type: "event",
				key: "moments-settings",
				event: "twitch:settings:momentsEnabled",
				callback: this.handleSettingsToggle.bind(this),
			},
		],
		enabled: () => this.settings().momentsEnabled,
	};

	async initialize() {
		const controller = new MomentsController({
			platform: "twitch",
			workerService: this.workerService(),
			loadDismissed: async () => (await this.localStorage().get("momentsDismissed")) ?? [],
			saveDismissed: (ids) => this.localStorage().save("momentsDismissed", ids),
			resolveOwnLogin: async () => this.twitchUtils().getOwnLogin() ?? null,
			insertCommand: (command) => this.twitchUtils().setChatText(command, true),
		});
		this.controller = controller;
		controller.start();
		effect(() => {
			const momentId = controller.moment.value?.id ?? null;
			queueMicrotask(() => this.syncPopup(momentId));
		});
	}

	private syncPopup(momentId: string | null) {
		const controller = this.controller;
		if (!controller) return;
		if (!momentId) {
			if (this.popupMomentId) this.emitter.emit("twitch:chatPopupClose", MomentsModule.POPUP_ID);
			this.popupMomentId = null;
			return;
		}
		if (this.popupMomentId === momentId && this.isPopupMounted()) return;
		this.popupMomentId = momentId;
		this.emitter.emit("twitch:chatPopupMessage", {
			id: MomentsModule.POPUP_ID,
			title: <MomentPopupTitle controller={controller} />,
			content: <MomentPopupContent controller={controller} />,
			compactContent: (expand) => <MomentPopupCompact controller={controller} expand={expand} />,
			autoclose: controller.autoCloseSeconds,
			appearance: "card",
			progress: controller.timeProgress,
			onClose: () => {
				this.popupMomentId = null;
				controller.onDismiss();
			},
		});
	}

	private isPopupMounted(): boolean {
		return document.querySelector(`[data-popup-id="${MomentsModule.POPUP_ID}"]`) !== null;
	}

	private handleChatList() {
		if (!this.controller || !this.isModuleEnabled()) return;
		void this.syncChannel();
		this.syncPopup(this.controller.moment.value?.id ?? null);
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
