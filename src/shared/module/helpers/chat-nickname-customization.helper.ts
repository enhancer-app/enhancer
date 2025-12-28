export class ChatNicknameCustomizationHelper {
	static applyGlowEffect(usernameElement: HTMLElement, color: string): void {
		usernameElement.style.textShadow = `${color} 0 0 10px`;
		usernameElement.style.color = color;
		usernameElement.style.fontWeight = "bold";
	}

	static applyCustomFont(usernameElement: HTMLElement, customFont: string, defaultFont: string): void {
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

	static applyBoldName(usernameElement: HTMLElement): void {
		usernameElement.style.fontWeight = "bold";
	}
}
