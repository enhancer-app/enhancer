import { mountNicknameTooltip } from "$shared/components/nickname-tooltip/nickname-tooltip.component.tsx";
import { realNameLabel } from "$shared/utils/nickname.utils.ts";

export class ChatNicknameCustomizationHelper {
	applyRealName(usernameElement: HTMLElement, displayName: string, login: string): void {
		usernameElement.dataset.enhancerRealName = realNameLabel(displayName, login);
		mountNicknameTooltip();
	}

	applyGlowEffect(usernameElement: HTMLElement, color: string): void {
		usernameElement.style.textShadow = `${color} 0 0 10px`;
		usernameElement.style.color = color;
		usernameElement.style.fontWeight = "bold";
	}

	applyCustomFont(usernameElement: HTMLElement, customFont: string, defaultFont: string): void {
		if (!customFont || customFont.trim() === "") {
			usernameElement.style.fontFamily = defaultFont;
			return;
		}

		const fontStack = customFont
			.split(",")
			.map((font) => `'${font.trim()}'`)
			.join(", ");

		usernameElement.style.fontFamily = `${fontStack}, ${defaultFont}`;
	}
}
