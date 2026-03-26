import KickModule from "$kick/kick.module.ts";
import { FUNNY_NAMES, FUNNY_TOOLTIPS } from "$shared/funny-thing/funny-things.ts";
import { ChatNicknameCustomizationHelper } from "$shared/module/helpers/chat-nickname-customization.helper.ts";
import type { EnhancerUser } from "$types/apis/enhancer.apis.ts";
import type { KickChatMessageData, KickChatMessageEvent } from "$types/platforms/kick/kick.events.types.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";

export default class ChatNicknameCustomizationModule extends KickModule {
	private readonly chatNicknameCustomizationHelper = new ChatNicknameCustomizationHelper();

	private isFunnyEnabled = false;

	config: KickModuleConfig = {
		name: "chat-nickname-customization",
		appliers: [
			{
				type: "event",
				key: "chat-nickname-customization",
				event: "kick:chatMessage",
				callback: this.handleMessage.bind(this),
			},
			{
				type: "event",
				key: "chat-nickname-customization",
				event: "kick:settings:_funnyThings",
				callback: (value) => {
					this.isFunnyEnabled = value;
				},
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

		let userCustomization = this.enhancerApi().findUserForCurrentChannel(message.sender.id.toString());

		const username = message.sender.username.toLowerCase();
		const funnyTooltip = FUNNY_TOOLTIPS[username] ?? "was definitely not changed by Enhancer";
		let addTooltip = false;
		if (this.isFunnyEnabled) {
			const funnyNickname = FUNNY_NAMES[username];
			if (funnyNickname) {
				userCustomization = { customNickname: funnyNickname } as EnhancerUser;
				addTooltip = true;
			}
		}
		if (!userCustomization) return;

		usernameElements.forEach((usernameElement) => {
			if (userCustomization.customNickname) {
				if (addTooltip) usernameElement.title = `Name ${funnyTooltip}`;
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

	async initialize(): Promise<void> {
		this.isFunnyEnabled = await this.settingsService().getSettingsKey("_funnyThings");
	}
}
