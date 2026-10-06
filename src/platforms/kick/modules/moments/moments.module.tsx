import KickModule from "$kick/kick.module.ts";
import { MomentCardComponent } from "$shared/components/moment-card/moment-card.component.tsx";
import { MomentsController } from "$shared/moments/moments-controller.ts";
import type { EnhancerMessageEvent } from "$types/apis/enhancer.apis.ts";
import type { KickChatMessageEvent } from "$types/platforms/kick/kick.events.types.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";
import { render } from "preact";

export default class MomentsModule extends KickModule {
	private controller: MomentsController | null = null;
	private cardHost: HTMLElement | null = null;
	private ownLogin: string | null | undefined;

	readonly config: KickModuleConfig = {
		name: "moments",
		appliers: [
			{
				type: "selector",
				key: "moments-card",
				selectors: ["#channel-chatroom"],
				callback: this.attachCard.bind(this),
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
		this.controller = new MomentsController({
			platform: "kick",
			workerService: this.workerService(),
			loadDismissed: async () => (await this.localStorage().get("momentsDismissed")) ?? [],
			saveDismissed: (ids) => this.localStorage().save("momentsDismissed", ids),
			resolveOwnLogin: () => this.getOwnLogin(),
			insertCommand: (command) => this.kickUtils().setChatInputContent(command, true),
		});
		this.controller.start();
	}

	private async getOwnLogin(): Promise<string | null> {
		if (this.ownLogin !== undefined) return this.ownLogin;
		const user = await this.kickApi().getCurrentUser();
		const login = user?.slug?.toLowerCase() ?? user?.username?.toLowerCase() ?? null;
		if (login) this.ownLogin = login;
		return login;
	}

	private attachCard(elements: Element[]) {
		if (!this.controller || !this.isModuleEnabled()) return;
		const chatRoom = elements.at(0) as HTMLElement | undefined;
		if (!chatRoom) return;
		if (!this.cardHost) {
			this.cardHost = document.createElement("div");
			this.cardHost.id = this.getId();
			render(<MomentCardComponent controller={this.controller} />, this.cardHost);
		}
		void this.commonUtils().waitFor(
			() => this.findInputAnchor(chatRoom),
			(anchor) => {
				if (this.cardHost && this.cardHost.nextSibling !== anchor) anchor.before(this.cardHost);
				void this.syncChannel();
				return true;
			},
			{ delay: 500, maxRetries: 20 },
		);
	}

	private findInputAnchor(chatRoom: HTMLElement): HTMLElement | undefined {
		const input =
			chatRoom.querySelector("#ntv__message-input") ?? chatRoom.querySelector('div[data-testid="chat-input"]');
		if (!(input instanceof HTMLElement)) return undefined;
		let anchor = input;
		while (anchor.parentElement && anchor.parentElement !== chatRoom) anchor = anchor.parentElement;
		return anchor.parentElement === chatRoom ? anchor : undefined;
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
		this.controller?.handleApiMessage(message.name);
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
		if (enabled && this.cardHost && !this.cardHost.isConnected) {
			const chatRoom = document.querySelector("#channel-chatroom");
			if (chatRoom) {
				const anchor = this.findInputAnchor(chatRoom as HTMLElement);
				if (anchor) anchor.before(this.cardHost);
				else chatRoom.prepend(this.cardHost);
			}
			void this.syncChannel();
		}
	}
}
