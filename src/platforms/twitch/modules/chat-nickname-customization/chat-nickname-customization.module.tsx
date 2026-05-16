import { ChatNicknameCustomizationHelper } from "$shared/module/helpers/chat-nickname-customization.helper.ts";
import TwitchModule from "$twitch/twitch.module.ts";
import type { TwitchChatMessageEvent } from "$types/platforms/twitch/twitch.events.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";

export default class ChatNicknameCustomizationModule extends TwitchModule {
	private readonly chatNicknameCustomizationHelper = new ChatNicknameCustomizationHelper();

	config: TwitchModuleConfig = {
		name: "chat-nickname-customization",
		appliers: [
			{
				type: "event",
				key: "chat-nickname-customization",
				event: "twitch:chatMessage",
				callback: this.handleMessage.bind(this),
			},
		],
		isModuleEnabledCallback: () => this.settingsService().getSettingsKey("chatNicknameCustomizationEnabled"),
	};

	private static DEFAULT_FONT = "var(--font-base)";

	private async handleMessage({ message, element }: TwitchChatMessageEvent) {
		if (!(await this.isModuleEnabled())) return;
		const usernameElement =
			element.querySelector<HTMLElement>(".chat-author__display-name") ||
			element.querySelector<HTMLElement>(".seventv-chat-user-username");
		if (!usernameElement) return;

		const userCustomization = this.enhancerApi().findUserForCurrentChannel(message.user.userID);
		if (!userCustomization) return;

		if (userCustomization.customNickname) {
			usernameElement.textContent = userCustomization.customNickname;
		}

		if (userCustomization.hasGlow) {
			this.applyGlow(usernameElement, message.user.color);
		}
		if (userCustomization.customFont) {
			this.chatNicknameCustomizationHelper.applyCustomFont(
				usernameElement,
				userCustomization.customFont,
				ChatNicknameCustomizationModule.DEFAULT_FONT,
			);
		}
	}

	private applyGlow(usernameElement: HTMLElement, userMessageColor: string | undefined) {
		let color: string;
		try {
			color =
				usernameElement.style.color ||
				(usernameElement.firstChild?.firstChild &&
					(usernameElement.firstChild.firstChild as HTMLElement).style.color) ||
				userMessageColor ||
				"white";
		} catch (_error) {
			color = userMessageColor || "white";
		}
		this.chatNicknameCustomizationHelper.applyGlowEffect(usernameElement, color);
	}
}
