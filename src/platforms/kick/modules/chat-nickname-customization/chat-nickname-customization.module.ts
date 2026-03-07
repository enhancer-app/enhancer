import KickModule from "$kick/kick.module.ts";
import { KICK_FUNNY_NAMES } from "$shared/april-thing/nicknames.ts";
import { ChatNicknameCustomizationHelper } from "$shared/module/helpers/chat-nickname-customization.helper.ts";
import type { EnhancerUser } from "$types/apis/enhancer.apis.ts";
import type { KickChatMessageData, KickChatMessageEvent } from "$types/platforms/kick/kick.events.types.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";

export default class ChatNicknameCustomizationModule extends KickModule {
	private readonly chatNicknameCustomizationHelper = new ChatNicknameCustomizationHelper();

	config: KickModuleConfig = {
		name: "chat-nickname-customization",
		appliers: [
			{
				type: "event",
				key: "chat-nickname-customization",
				event: "kick:chatMessage",
				callback: this.handleMessage.bind(this),
			},
		],
		isModuleEnabledCallback: () => this.settingsService().getSettingsKey("chatNicknameCustomizationEnabled"),
	};

	private static DEFAULT_FONT = "Inter, Inter Fallback";

	private async handleMessage({ message, element }: KickChatMessageEvent) {
		if (!(await this.isModuleEnabled())) return;
		const usernameElements = [
			...element.querySelectorAll<HTMLElement>(".ntv__chat-message__username"),
			...element.querySelectorAll<HTMLElement>(`[title='${message.sender.slug}']`),
		];
		if (usernameElements.length < 1) return;

		let userCustomization = null; //this.enhancerApi().findUserForCurrentChannel(message.sender.id.toString());
		const funnyNickname = KICK_FUNNY_NAMES[message.sender.username.toLowerCase()];
		if (!userCustomization && funnyNickname) {
			userCustomization = { customNickname: funnyNickname } as EnhancerUser;
		}
		if (!userCustomization) return;

		usernameElements.forEach((usernameElement) => {
			if (userCustomization.customNickname) {
				usernameElement.innerText = userCustomization.customNickname;
			}
			if (userCustomization.hasGlow) {
				this.applyGlowEffect(usernameElement, message);
			}
			if (userCustomization.customFont) {
				this.chatNicknameCustomizationHelper.applyCustomFont(
					usernameElement,
					userCustomization.customFont,
					ChatNicknameCustomizationModule.DEFAULT_FONT,
				);
			}
		});
	}

	private applyGlowEffect(usernameElement: HTMLElement, messageData: KickChatMessageData) {
		const color =
			usernameElement.style.color ||
			(usernameElement.firstChild?.firstChild && (usernameElement.firstChild.firstChild as HTMLElement).style.color) ||
			messageData.sender.identity.color ||
			"white";
		this.chatNicknameCustomizationHelper.applyGlowEffect(usernameElement, color);
	}
}
