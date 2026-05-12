import { FUNNY_NAMES, FUNNY_TOOLTIPS } from "$shared/funny-thing/funny-things.ts";
import { ChatNicknameCustomizationHelper } from "$shared/module/helpers/chat-nickname-customization.helper.ts";
import TwitchModule from "$twitch/twitch.module.ts";
import type { EnhancerUser } from "$types/apis/enhancer.apis.ts";
import type { TwitchChatMessageEvent } from "$types/platforms/twitch/twitch.events.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";

export default class ChatNicknameCustomizationModule extends TwitchModule {
	private readonly chatNicknameCustomizationHelper = new ChatNicknameCustomizationHelper();

	private isFunnyEnabled = false;

	config: TwitchModuleConfig = {
		name: "chat-nickname-customization",
		appliers: [
			{
				type: "event",
				key: "chat-nickname-customization",
				event: "twitch:chatMessage",
				callback: this.handleMessage.bind(this),
			},
			{
				type: "event",
				key: "chat-nickname-customization",
				event: "twitch:settings:_funnyThings",
				callback: (value) => {
					this.isFunnyEnabled = value;
				},
			},
		],
		enabled: () => this.settings().chatNicknameCustomizationEnabled,
	};

	private static DEFAULT_FONT = "var(--font-base)";

	private async handleMessage({ message, element }: TwitchChatMessageEvent) {
		if (!(await this.isModuleEnabled())) return;
		const usernameElement =
			element.querySelector<HTMLElement>(".chat-author__display-name") ||
			element.querySelector<HTMLElement>(".seventv-chat-user-username");
		if (!usernameElement) return;

		let userCustomization = this.enhancerApi().findUserForCurrentChannel(message.user.userID);

		const username = message.user.userDisplayName.toLowerCase() ?? message.user.userLogin.toLowerCase();
		const funnyTooltip = FUNNY_TOOLTIPS[username] ?? "was definitely not changed by Enhancer";
		let addTooltip = false;
		if (this.isFunnyEnabled && this.commonUtils().isFunnyDay()) {
			const funnyNickname = FUNNY_NAMES[username];
			if (funnyNickname) {
				userCustomization = { customNickname: funnyNickname } as EnhancerUser;
				addTooltip = true;
			}
		}

		if (!userCustomization) return;

		if (userCustomization.customNickname) {
			if (addTooltip) usernameElement.title = `Name ${funnyTooltip}`;
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
		} catch (error) {
			color = userMessageColor || "white";
		}
		this.chatNicknameCustomizationHelper.applyGlowEffect(usernameElement, color);
	}

	initialize(): void {
		this.isFunnyEnabled = this.settings()._funnyThings;
	}
}
