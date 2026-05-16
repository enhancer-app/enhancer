import { ImagePreview } from "$shared/components/image-preview/image-preview.component";
import { HttpClient } from "$shared/http/http-client.ts";
import type ChatAttachmentHandler from "$shared/module/chat-attachments/chat-attachment-handler.ts";
import ImageChatAttachmentHandler from "$shared/module/chat-attachments/image-chat-attachment-handler.ts";
import { ImageChatAttachmentConfig } from "$shared/module/chat-attachments/image-chat-attachment.config.ts";
import TwitchModule from "$twitch/twitch.module.ts";
import type { TwitchChatMessageEvent } from "$types/platforms/twitch/twitch.events.types.ts";
import {
	type BaseChatAttachmentData,
	type ChatAttachmentData,
	ChatAttachmentMessageType,
} from "$types/shared/module/chat-attachment/chat-attachment.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";

export default class ChatAttachmentsModule extends TwitchModule {
	private readonly httpClient = new HttpClient();
	private readonly imageAttachmentConfig = new ImageChatAttachmentConfig(this.settings(), this.workerService(), () => {
		this.twitchUtils().unstuckScroll();
	});
	private previousInputContent = "";
	private inputMonitoringInterval: NodeJS.Timeout | undefined;

	static readonly FFZ_RICH_EMBED_CLASS = ".ffz-card-rich";

	config: TwitchModuleConfig = {
		name: "chat-attachments",
		appliers: [
			{
				type: "event",
				key: "chat-attachments",
				event: "twitch:chatMessage",
				callback: this.handleMessage.bind(this),
			},
			{
				type: "event",
				key: "settings-chat-images-size",
				event: "twitch:settings:chatImagesSize",
				callback: (size) => this.imageAttachmentConfig.updateMaxFileSize(size),
			},
			{
				type: "event",
				key: "settings-chat-images-on-hover",
				event: "twitch:settings:chatImagesOnHover",
				callback: (enabled) => this.imageAttachmentConfig.updateImagesOnHover(enabled),
			},
			{
				type: "event",
				key: "settings-chat-images-enabled",
				event: "twitch:settings:chatImagesEnabled",
				callback: (enabled) => (enabled ? this.startInputMonitoring() : this.stopInputMonitoring()),
			},
		],
		enabled: () => this.settings().chatImagesEnabled,
	};

	private readonly chatAttachmentHandlers: ChatAttachmentHandler[] = [
		new ImageChatAttachmentHandler(this.logger, this.imageAttachmentConfig),
	];

	private async handleMessage(message: TwitchChatMessageEvent) {
		if (!(await this.isModuleEnabled())) return;

		await this.commonUtils().delay(1); // Doing this for FFZ Rich Embed Check
		if (message.element.querySelector(ChatAttachmentsModule.FFZ_RICH_EMBED_CLASS)) return;

		const baseData = this.getBaseData(message);
		if (!baseData) return;
		try {
			const result = await this.resolveChatAttachmentHandler(baseData);
			if (result?.applies) await result.chatAttachmentHandler.handle(result.data);
		} catch (error) {
			this.logger.error("Failed to handle chat attachment:", error);
		}
	}

	private async resolveChatAttachmentHandler(baseData: BaseChatAttachmentData) {
		const chatAttachmentHandler = this.chatAttachmentHandlers.find((chatAttachmentHandler) =>
			chatAttachmentHandler.validate(baseData),
		);
		if (!chatAttachmentHandler) return;
		baseData.url = chatAttachmentHandler.parseUrl(baseData.url);
		const data = await this.getData(baseData);
		return { applies: await chatAttachmentHandler.applies(data), chatAttachmentHandler, data };
	}

	private getBaseData(message: TwitchChatMessageEvent): BaseChatAttachmentData | undefined {
		const messageText = message.message.message ?? message.message.messageBody;
		if (!messageText) return;
		const args = messageText.split(" ");
		const links = [...message.element.querySelectorAll("a")] as Element[];
		const firstWord = args.at(0);
		const firstElement = links.at(0);
		const lastWord = args.at(-1);
		const lastElement = links.at(-1);

		if (this.commonUtils().isValidUrl(firstWord) && firstElement) {
			return { messageType: ChatAttachmentMessageType.FIRST, url: new URL(firstWord), messageElement: firstElement };
		}
		if (this.commonUtils().isValidUrl(lastWord) && lastElement) {
			return { messageType: ChatAttachmentMessageType.LAST, url: new URL(lastWord), messageElement: lastElement };
		}
	}

	private async getData(baseData: BaseChatAttachmentData): Promise<ChatAttachmentData> {
		const attachmentData = await this.getAttachmentData(baseData.url);
		if (!attachmentData || !attachmentData.type || !attachmentData.size)
			throw new Error("Couldn't get attachment data");
		return {
			...baseData,
			attachmentType: attachmentData.type,
			attachmentSize: Number.parseInt(attachmentData.size, 10),
		};
	}

	private async getAttachmentData(url: URL) {
		try {
			const { response } = await this.httpClient.request(url.href, {
				method: "HEAD",
				responseType: "text",
			});
			return { type: response.headers.get("Content-Type"), size: response.headers.get("Content-Length") };
		} catch (error) {
			this.logger.warn("Couldn't get attachment data", error);
		}
	}

	private startInputMonitoring() {
		if (this.inputMonitoringInterval) return;
		this.inputMonitoringInterval = setInterval(async () => {
			const chatInputContent = this.twitchUtils().getChatInputContent();
			if (!chatInputContent) return;

			const words = chatInputContent.split(" ");
			const firstWord = words.at(0);
			const lastWord = words.at(-1);
			const firstWordData = this.simulateBaseData(firstWord);
			const lastWordData = this.simulateBaseData(lastWord);

			const attachmentResolved =
				(firstWordData && (await this.resolveChatAttachmentHandler(firstWordData))?.applies) ||
				(lastWordData && (await this.resolveChatAttachmentHandler(lastWordData))?.applies);

			const url = firstWordData?.url?.toString() || lastWordData?.url?.toString();
			if (attachmentResolved && url) {
				if (this.previousInputContent === url) return;
				this.previousInputContent = url;
				this.emitter.emit("twitch:chatPopupMessage", {
					title: "Image preview",
					autoclose: 3,
					content: ImagePreview(url), // Later we need to get this thing from chat attachment handler, because there might be different things like audios or something else
				});
			}
		}, 500);
	}

	private stopInputMonitoring() {
		if (this.inputMonitoringInterval) {
			clearInterval(this.inputMonitoringInterval);
			this.inputMonitoringInterval = undefined;
		}
	}

	private simulateBaseData(word: string | undefined): BaseChatAttachmentData | undefined {
		if (word && this.commonUtils().isValidUrl(word)) {
			return {
				messageType: ChatAttachmentMessageType.FIRST,
				url: new URL(word),
			} as BaseChatAttachmentData;
		}
		return undefined;
	}

	async initialize() {
		await this.imageAttachmentConfig.initialize();
		if (await this.isModuleEnabled()) this.startInputMonitoring();

		this.commonUtils().createGlobalStyle(`
			.enhancer-chat-link {
				display: block;
				width: fit-content;
				margin: 0.5rem 0;
			}
			
			.enhancer-chat-image {
				min-height: 16px;
				max-height: 256px;
				width: 100%;
				transition: filter 0.3s ease-in-out;
			}`);
	}
}
