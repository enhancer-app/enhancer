import KickModule from "$kick/kick.module.ts";
import { BadgeComponent } from "$shared/components/badge/badge.component.tsx";
import { TooltipComponent } from "$shared/components/tooltip/tooltip.component.tsx";
import type { KickChatMessageEvent } from "$types/platforms/kick/kick.events.types.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";
import { render } from "preact";

export default class ChatFixAutoScrollModule extends KickModule {
	config: KickModuleConfig = {
		name: "chat-fix-auto-scroll",
		appliers: [
			{
				type: "event",
				key: "chat-fix-auto-scroll",
				event: "kick:chatMessage",
				callback: this.handleMessage.bind(this),
			},
		],
	};

	private async handleMessage() {
		await this.commonUtils().delay(3);
		await this.kickUtils().scrollToBottomOnChat();
	}
}
