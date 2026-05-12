import type WorkerService from "$shared/worker/worker.service.ts";
import type { PlatformSettings } from "$types/shared/worker/settings-worker.types.ts";
import { type Signal, signal } from "@preact/signals";

export class ImageChatAttachmentConfig {
	readonly maxFileSize: Signal<number> = signal(1);
	readonly isEnabled: Signal<boolean> = signal(false);
	readonly imagesOnHover: Signal<boolean> = signal(true);
	imageOnHoverSource = "https://enhancer.at/assets/chat-image-hover.png";
	readonly callback: () => Promise<void> | void;

	constructor(
		settings: PlatformSettings,
		private workerService: WorkerService,
		callback: () => Promise<void> | void,
	) {
		this.callback = callback;
		this.maxFileSize.value = settings.chatImagesSize;
		this.imagesOnHover.value = settings.chatImagesOnHover;
		this.isEnabled.value = settings.chatImagesEnabled;
	}

	async initialize() {
		const response = await this.workerService.send("getAssetsFile", { path: "modules/chat-image-hover.png" });
		if (response) this.imageOnHoverSource = response.url;
	}

	updateMaxFileSize(size: number) {
		this.maxFileSize.value = size;
	}

	updateImagesOnHover(enabled: boolean) {
		this.imagesOnHover.value = enabled;
	}

	updateEnabled(enabled: boolean) {
		this.isEnabled.value = enabled;
	}
}
