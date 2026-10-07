import KickModule from "$kick/kick.module.ts";
import {
	MomentPopupCompact,
	MomentPopupContent,
	MomentPopupTitle,
} from "$shared/components/moment-card/moment-card.component.tsx";
import { MomentsController } from "$shared/moments/moments-controller.ts";
import type { EnhancerMessageEvent } from "$types/apis/enhancer.apis.ts";
import type { KickChatMessageEvent } from "$types/platforms/kick/kick.events.types.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";
import { effect } from "@preact/signals";

export default class MomentsModule extends KickModule {
	private static readonly POPUP_ID = "moment";

	private controller: MomentsController | null = null;
	private popupMomentId: string | null = null;
	private ownLogin: string | null | undefined;

	readonly config: KickModuleConfig = {
		name: "moments",
		appliers: [
			{
				type: "selector",
				key: "moments-chat-footer",
				selectors: ["#chatroom-footer"],
				callback: this.handleChatFooter.bind(this),
				once: true,
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
				event: "kick:chatMessage",
				callback: this.handleChatMessage.bind(this),
			},
			{
				type: "event",
				key: "moments-settings",
				event: "kick:settings:momentsEnabled",
				callback: this.handleSettingsToggle.bind(this),
			},
		],
		enabled: () => this.settings().momentsEnabled,
	};

	async initialize() {
		const controller = new MomentsController({
			platform: "kick",
			workerService: this.workerService(),
			loadDismissed: async () => (await this.localStorage().get("momentsDismissed")) ?? [],
			saveDismissed: (ids) => this.localStorage().save("momentsDismissed", ids),
			resolveOwnLogin: () => this.getOwnLogin(),
			insertCommand: (command) => this.kickUtils().setChatInputContent(command, true),
		});
		this.controller = controller;
		controller.start();
		effect(() => {
			const momentId = controller.moment.value?.id ?? null;
			queueMicrotask(() => this.syncPopup(momentId));
		});
	}

	private async getOwnLogin(): Promise<string | null> {
		if (this.ownLogin !== undefined) return this.ownLogin;
		const user = await this.kickApi().getCurrentUser();
		const login = user?.slug?.toLowerCase() ?? user?.username?.toLowerCase() ?? null;
		if (login) this.ownLogin = login;
		return login;
	}

	private syncPopup(momentId: string | null) {
		const controller = this.controller;
		if (!controller) return;
		if (!momentId) {
			if (this.popupMomentId) this.emitter.emit("kick:chatPopupClose", MomentsModule.POPUP_ID);
			this.popupMomentId = null;
			return;
		}
		if (this.popupMomentId === momentId && this.isPopupMounted()) return;
		this.popupMomentId = momentId;
		this.emitter.emit("kick:chatPopupMessage", {
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

	private handleChatFooter() {
		if (!this.controller || !this.isModuleEnabled()) return;
		void this.syncChannel();
		this.syncPopup(this.controller.moment.value?.id ?? null);
	}

	private async syncChannel() {
		await this.commonUtils().waitFor(
			() => this.kickUtils().getChannelInfo()?.channelId,
			(channelId) => {
				this.handleChannel(channelId.toString());
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
		const channelId = this.kickUtils().getChannelInfo()?.channelId;
		if (channelId) this.handleChannel(channelId.toString());
	}

	private handleApiMessage(message: EnhancerMessageEvent) {
		if (!this.isModuleEnabled()) return;
		this.controller?.handleApiMessage(message.name, message.data);
	}

	private async handleChatMessage({ message }: KickChatMessageEvent) {
		if (!this.isModuleEnabled()) return;
		const ownLogin = await this.getOwnLogin();
		if (!ownLogin) return;
		const sender = message.sender.slug?.toLowerCase() ?? message.sender.username.toLowerCase();
		if (sender !== ownLogin) return;
		this.controller?.handleOwnChatMessage(message.content, ownLogin);
	}

	private handleSettingsToggle(enabled: boolean) {
		this.controller?.setEnabled(enabled);
		if (enabled) void this.syncChannel();
	}
}
