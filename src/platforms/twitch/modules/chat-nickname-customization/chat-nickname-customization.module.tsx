import TwitchModule from "$twitch/twitch.module.ts";
import type { TwitchChatMessageEvent } from "$types/platforms/twitch/twitch.events.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import { render } from "preact";
import styled, { css } from "styled-components";

export default class ChatNicknameCustomizationModule extends TwitchModule {
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
	}

	private applyGlow(element: HTMLElement, userMessageColor: string | undefined) {
		let color: string;
		try {
			color =
				element.style.color ||
				(element.firstChild?.firstChild && (element.firstChild.firstChild as HTMLElement).style.color) ||
				userMessageColor ||
				"white";
		} catch (error) {
			color = userMessageColor || "white";
		}
		element.style.textShadow = `${color} 0 0 10px`;
		element.style.fontWeight = "bold";
	}
}
