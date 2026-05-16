import {
	MessageMenuComponent,
	type MessageMenuEvent,
} from "$shared/components/message-menu/message-menu.component.tsx";
import TwitchModule from "$twitch/twitch.module.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import { render } from "preact";

export default class MessageMenuModule extends TwitchModule {
	config: TwitchModuleConfig = {
		name: "message-popup",
		appliers: [
			{
				type: "event",
				event: "twitch:messageMenu",
				callback: this.render.bind(this),
				key: "message-popup",
			},
		],
	};

	private render(message: MessageMenuEvent) {
		let wrapper = document.querySelector(`#${this.getId()}`);
		if (wrapper) wrapper.remove();
		wrapper = document.createElement("div");
		wrapper.id = this.getId();
		const originalClose = message.onClose;
		const onClose = () => {
			if (originalClose) originalClose();
			wrapper.remove();
		};
		render(<MessageMenuComponent {...message} onClose={onClose} />, wrapper);
		document.body.append(wrapper);
	}
}
