import { MomentCardComponent } from "$shared/components/moment-card/moment-card.component.tsx";
import { MomentsController } from "$shared/moments/moments-controller.ts";
import TwitchModule from "$twitch/twitch.module.ts";
import type { EnhancerMessageEvent } from "$types/apis/enhancer.apis.ts";
import type { TwitchChatMessageEvent } from "$types/platforms/twitch/twitch.events.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import { render } from "preact";

export default class MomentsModule extends TwitchModule {
	private controller: MomentsController | null = null;
	private cardHost: HTMLElement | null = null;

	readonly config: TwitchModuleConfig = {
		name: "moments",
		appliers: [
			{
				type: "selector",
				key: "moments-card",
				selectors: [".chat-input"],
				callback: this.attachCard.bind(this),
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
		this.controller = new MomentsController({
			platform: "twitch",
			workerService: this.workerService(),
			loadDismissed: async () => (await this.localStorage().get("momentsDismissed")) ?? [],
			saveDismissed: (ids) => this.localStorage().save("momentsDismissed", ids),
			resolveOwnLogin: async () => this.twitchUtils().getOwnLogin() ?? null,
			insertCommand: (command) => this.twitchUtils().setChatText(command, true),
		});
		this.controller.start();
	}

	private attachCard(elements: Element[]) {
		if (!this.controller || !this.isModuleEnabled()) return;
		const chatInput = elements.at(0) as HTMLElement | undefined;
		if (!chatInput) return;
		if (!this.cardHost) {
			this.cardHost = document.createElement("div");
			this.cardHost.id = this.getId();
			render(<MomentCardComponent controller={this.controller} />, this.cardHost);
		}
		if (this.cardHost.parentElement !== chatInput) chatInput.prepend(this.cardHost);
		void this.syncChannel();
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
		this.controller?.handleApiMessage(message.name);
	}

	private handleChatMessage({ message }: TwitchChatMessageEvent) {
		if (!this.isModuleEnabled()) return;
		const ownLogin = this.twitchUtils().getOwnLogin();
		if (!ownLogin || message.user.userLogin.toLowerCase() !== ownLogin) return;
		this.controller?.handleOwnChatMessage(message.message ?? message.messageBody ?? "", ownLogin);
	}

	private handleSettingsToggle(enabled: boolean) {
		this.controller?.setEnabled(enabled);
		if (enabled && this.cardHost && !this.cardHost.isConnected) {
			const chatInput = document.querySelector(".chat-input");
			if (chatInput) chatInput.prepend(this.cardHost);
			void this.syncChannel();
		}
	}
}
