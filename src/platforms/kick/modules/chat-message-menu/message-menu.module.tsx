import { h, render } from "preact";
import KickModule from "$kick/kick.module.ts";
import {
	MessageMenuComponent,
	type MessageMenuEvent,
} from "$shared/components/message-menu/message-menu.component.tsx";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";

export default class MessageMenuModule extends KickModule {
	config: KickModuleConfig = {
		name: "message-popup",
		appliers: [
			{
				type: "event",
				event: "kick:messageMenu",
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
