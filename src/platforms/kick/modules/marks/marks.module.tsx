import KickModule from "$kick/kick.module.ts";
import {
	MarkPopupCompact,
	MarkPopupContent,
	MarkPopupTitle,
} from "$shared/components/mark-card/mark-card.component.tsx";
import { MarksController } from "$shared/marks/marks-controller.ts";
import type { EnhancerMessageEvent } from "$types/apis/enhancer.apis.ts";
import type { KickChatMessageEvent } from "$types/platforms/kick/kick.events.types.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";
import { effect } from "@preact/signals";

export default class MarksModule extends KickModule {
	private static readonly POPUP_ID = "mark";

	private controller: MarksController | null = null;
	private popupMarkId: string | null = null;
	private ownLogin: string | null | undefined;

	readonly config: KickModuleConfig = {
		name: "marks",
		appliers: [
			{
				type: "selector",
				key: "marks-chat-footer",
				selectors: ["#chatroom-footer"],
				callback: this.handleChatFooter.bind(this),
				once: true,
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
				event: "kick:chatMessage",
				callback: this.handleChatMessage.bind(this),
			},
			{
				type: "event",
				key: "marks-settings",
				event: "kick:settings:marksEnabled",
				callback: this.handleSettingsToggle.bind(this),
			},
		],
		enabled: () => this.settings().marksEnabled,
	};

	async initialize() {
		const controller = new MarksController({
			platform: "kick",
			workerService: this.workerService(),
			loadDismissed: async () => (await this.localStorage().get("marksDismissed")) ?? [],
			saveDismissed: (ids) => this.localStorage().save("marksDismissed", ids),
			resolveOwnLogin: () => this.getOwnLogin(),
			insertCommand: (command) => this.kickUtils().setChatInputContent(command, true),
		});
		this.controller = controller;
		controller.start();
		effect(() => {
			const markId = controller.mark.value?.id ?? null;
			queueMicrotask(() => this.syncPopup(markId));
		});
	}

	private async getOwnLogin(): Promise<string | null> {
		if (this.ownLogin !== undefined) return this.ownLogin;
		const user = await this.kickApi().getCurrentUser();
		const login = user?.slug?.toLowerCase() ?? user?.username?.toLowerCase() ?? null;
		if (login) this.ownLogin = login;
		return login;
	}

	private syncPopup(markId: string | null) {
		const controller = this.controller;
		if (!controller) return;
		if (!markId) {
			if (this.popupMarkId) this.emitter.emit("kick:chatPopupClose", MarksModule.POPUP_ID);
			this.popupMarkId = null;
			return;
		}
		if (this.popupMarkId === markId && this.isPopupMounted()) return;
		this.popupMarkId = markId;
		this.emitter.emit("kick:chatPopupMessage", {
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

	private handleChatFooter() {
		if (!this.controller || !this.isModuleEnabled()) return;
		void this.syncChannel();
		this.syncPopup(this.controller.mark.value?.id ?? null);
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
