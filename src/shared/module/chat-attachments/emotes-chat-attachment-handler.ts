import type { Logger } from "$shared/logger/logger.ts";
import type {
	BaseChatAttachmentData,
	ChatAttachmentData,
} from "$types/shared/module/chat-attachment/chat-attachment.types.ts";
import ChatAttachmentHandler from "./chat-attachment-handler";

export default class EmotesChatAttachmentHandler extends ChatAttachmentHandler {
	constructor(protected readonly logger: Logger) {
		super(logger);
	}

	static readonly ALLOWED_HOSTS = ["7tv.app", "old.7tv.app"];

	validate(baseData: BaseChatAttachmentData): boolean {
		return EmotesChatAttachmentHandler.ALLOWED_HOSTS.some((host) => baseData.url.host === host);
	}

	async applies(data: ChatAttachmentData): Promise<boolean> {
		return true;
		// throw new Error("Not implemented");
	}

	parseUrl(url: URL): URL {
		// INPUT: https://7tv.app/emotes/01F6MDFCSR0000WDA7ERT623YT
		// OUTPUT: https://7tv.io/v3/emotes/01F6MDFCSR0000WDA7ERT623YT
		// TODO: Parse only single emotes for now

		url.host = "7tv.io";
		url.pathname = `/v3${url.pathname}`;

		return url;
	}

	async handle(data: ChatAttachmentData) {
		// ! Temporary, as alternative for not supported emote data fetching
		const emoteData = await (await fetch(data.url.href)).json();

		const element = data.messageElement as HTMLLinkElement;

		element.classList.add("enhancer-emote-link");

		const wrapper = document.createElement("div");
		element.replaceChildren(wrapper);
		wrapper.style.backgroundColor = "grey";
		wrapper.style.borderRadius = "4px";
		wrapper.style.padding = "8px";
		wrapper.style.display = "flex";
		wrapper.style.flexDirection = "row";
		wrapper.style.gap = "8px";
		wrapper.style.textDecoration = "none";

		const emotePreview = document.createElement("img");
		emotePreview.src = `https://cdn.7tv.app/emote/${emoteData.id}/${emoteData.host.files[0].name}`;
		emotePreview.style.width = "48px";
		emotePreview.style.height = "48px";
		wrapper.append(emotePreview);

		const emoteDataWrapper = document.createElement("div");
		emoteDataWrapper.style.display = "flex";
		emoteDataWrapper.style.flexDirection = "column";
		emoteDataWrapper.style.justifyContent = "space-between";
		wrapper.append(emoteDataWrapper);

		const emoteName = document.createElement("span");
		emoteName.textContent = emoteData.name || "Emote Name";
		emoteName.style.color = "white";
		emoteName.style.textDecoration = "none";
		emoteDataWrapper.append(emoteName);

		const emoteAuthor = document.createElement("span");
		emoteAuthor.textContent = `Created by ${emoteData.owner.username || "unknown"}`;
		emoteAuthor.style.color = "white";
		emoteAuthor.style.textDecoration = "none";
		emoteDataWrapper.append(emoteAuthor);
	}
}
