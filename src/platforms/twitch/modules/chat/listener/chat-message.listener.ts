import type { Logger } from "$shared/logger/logger.ts";
import type { TwitchChatMessage } from "$types/platforms/twitch/twitch.utils.types.ts";
import { createNanoEvents } from "nanoevents";
import type TwitchUtils from "../../../twitch.utils.ts";

export default abstract class ChatMessageListener {
	readonly emitter = createNanoEvents<TwitchChatMessageEvents>();
	constructor(
		protected readonly logger: Logger,
		protected readonly twitchUtilsRepository: TwitchUtils,
	) {}

	abstract inject(): void;
}

type TwitchChatMessageEvents = {
	inject: () => void;
	message: (message: TwitchChatMessage) => void;
};
