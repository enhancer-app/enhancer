import KickModule from "$kick/kick.module.ts";
import type { KickChatMessageData, KickChatMessageEvent } from "$types/platforms/kick/kick.events.types.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";

export default class ChatNicknameCustomizationModule extends KickModule {
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

		const userCustomization = this.enhancerApi().findUserForCurrentChannel(message.sender.id.toString());
		if (!userCustomization) return;

		usernameElements.forEach((usernameElement) => {
			if (userCustomization.customNickname) {
				usernameElement.innerText = userCustomization.customNickname;
			}
			if (userCustomization.hasGlow) {
				this.applyGlowEffect(usernameElement, message);
			}
			//TODO remove
			userCustomization.customFont = "Potta One";
			if (userCustomization.customFont) {
				this.applyCustomFont(usernameElement, userCustomization.customFont);
			}
		});
	}

	private applyGlowEffect(usernameElement: HTMLElement, messageData: KickChatMessageData) {
		const color =
			usernameElement.style.color ||
			(usernameElement.firstChild?.firstChild && (usernameElement.firstChild.firstChild as HTMLElement).style.color) ||
			messageData.sender.identity.color ||
			"white";
		usernameElement.style.textShadow = `${color} 0 0 10px`;
		usernameElement.style.color = color;
		usernameElement.style.fontWeight = "bold";
	}

	private applyCustomFont(usernameElement: HTMLElement, customFont: string) {
		if (!customFont || customFont.trim() === "") {
			usernameElement.style.fontFamily = ChatNicknameCustomizationModule.DEFAULT_FONT;
			return;
		}

		const fontStack = customFont
			.split(",")
			.map((font) => `'${font.trim()}'`)
			.join(", ");

		usernameElement.style.fontFamily = `${fontStack}, ${ChatNicknameCustomizationModule.DEFAULT_FONT}`;
	}
}
