import type { Logger } from "$shared/logger/logger.ts";
import ChatAttachmentHandler from "$shared/module/chat-attachments/chat-attachment-handler.ts";
import type { ImageChatAttachmentConfig } from "$shared/module/chat-attachments/image-chat-attachment.config.ts";
import {
	type AttachmentUrlParser,
	type BaseChatAttachmentData,
	type ChatAttachmentData,
	ChatAttachmentMessageType,
} from "$types/shared/module/chat-attachment/chat-attachment.types.ts";
import type { Signal } from "@preact/signals";

export default class ImageChatAttachmentHandler extends ChatAttachmentHandler {
	constructor(
		readonly logger: Logger,
		private readonly config: ImageChatAttachmentConfig,
	) {
		super(logger);
	}

	static readonly ALLOWED_HOSTS = [
		"media.giphy.com",
		"c.tenor.com",
		"media.discordapp.net",
		"cdn.discordapp.com",
		"images-ext-1.discordapp.net",
		"images-ext-2.discordapp.net",
		"images.discordapp.net",
		"imagizer.imageshack.com",
		"imgur.com",
		"i.imgur.com",
		"i.nuuls.com",
		"kappa.lol",
		"files.igor.ovh",
		"prnt.sc",
		"files.catbox.moe",
	];
	static readonly CORSGO_PROXY_URL_PARSER = (url: URL) => {
		const corsgoUrl = new URL("https://corsgo.enhancer.at/proxy");
		corsgoUrl.searchParams.append("url", url.href);
		return corsgoUrl;
	};
	static readonly URL_PARSERS: AttachmentUrlParser = {
		"cdn.discordapp.com": (url) => {
			url.host = "media.discordapp.net";
			return url;
		},
		"prnt.sc": ImageChatAttachmentHandler.CORSGO_PROXY_URL_PARSER,
		"files.catbox.moe": ImageChatAttachmentHandler.CORSGO_PROXY_URL_PARSER,
		"imgur.com": ImageChatAttachmentHandler.CORSGO_PROXY_URL_PARSER,
	};

	static readonly DISCORD_CACHE_PREVIEW_PARSER = (url: URL) => {
		const previewUrl = new URL("https://preview.enhancer.at");
		previewUrl.searchParams.append("type", "image");
		previewUrl.searchParams.append("preview", url.href);
		return previewUrl;
	};
	static readonly PREVIEW_URL_PARSERS: AttachmentUrlParser = {
		"images-ext-1.discordapp.net": ImageChatAttachmentHandler.DISCORD_CACHE_PREVIEW_PARSER,
		"images-ext-2.discordapp.net": ImageChatAttachmentHandler.DISCORD_CACHE_PREVIEW_PARSER,
		// We need only proxy to show message in the chat, after this we can navigate user to original link
		"corsgo.enhancer.at": (url) => {
			const paramUrl = url.searchParams.get("url");
			if (paramUrl) {
				try {
					return new URL(paramUrl);
				} catch (_) {}
			}
			return url;
		},
	};

	validate(baseData: BaseChatAttachmentData) {
		return (
			ImageChatAttachmentHandler.ALLOWED_HOSTS.some((host) => baseData.url.host === host) &&
			!this.isImgurAlbum(baseData.url)
		);
	}

	async applies(data: ChatAttachmentData) {
		return (
			data.attachmentType.startsWith("image/") && data.attachmentSize < this.config.maxFileSize.value * 1024 * 1024
		);
	}

	public parseUrl(url: URL): URL {
		return ImageChatAttachmentHandler.URL_PARSERS[url.host]?.(url) ?? url;
	}

	async handle(data: ChatAttachmentData) {
		const element = data.messageElement as HTMLLinkElement;
		const image = new Image();
		const imageSource = this.parseUrl(data.url).href;
		image.classList.add("enhancer-chat-image");

		const styleAsFakeImage = () => {
			image.style.objectFit = "contain";
			image.style.backgroundColor = "rgba(22, 16, 33, 1)";
			image.style.backgroundImage = "linear-gradient(57deg, rgba(22, 16, 33, 1) 0%, rgba(94, 45, 191, 1) 100%)";
		};

		const styleAsOriginal = () => {
			image.style.objectFit = "";
			image.style.background = "";
			image.style.backgroundImage = "";
		};

		const renderImage = async () => {
			element.href = this.parsePreviewUrl(data.url).href;
			element.classList.add("enhancer-chat-link");
			element.replaceChildren(image);
			image.style.width = `${image.width}px`;
			image.style.height = `${image.height}px`;
			if (this.config.imagesOnHover.value) {
				styleAsFakeImage();
				image.src = this.config.imageOnHoverSource;
			}
			await this.config.callback();
		};

		let isRendered = false;
		let renderingOriginal = !this.config.imagesOnHover.value;

		image.src = imageSource;
		image.onload = async () => {
			if (!isRendered) {
				await renderImage();
				isRendered = true;
			}
			if (renderingOriginal) styleAsOriginal();
			else styleAsFakeImage();
		};

		if (this.config.imagesOnHover.value) {
			image.addEventListener("mouseenter", () => {
				renderingOriginal = true;
				image.src = imageSource;
			});
			image.addEventListener("mouseleave", () => {
				renderingOriginal = false;
				image.src = this.config.imageOnHoverSource;
			});
		}

		image.onerror = () => {
			this.logger.warn("Failed to load image");
		};
	}

	private parsePreviewUrl(url: URL): URL {
		return ImageChatAttachmentHandler.PREVIEW_URL_PARSERS[url.host]?.(url) ?? url;
	}

	private isImgurAlbum(url: URL) {
		return url.host === "i.imgur.com" && url.pathname.includes("/a/");
	}
}
