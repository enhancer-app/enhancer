import { type Signal, signal } from "@preact/signals";
import type SettingsService from "$shared/settings/settings.service.ts";
import type WorkerService from "$shared/worker/worker.service.ts";
import type { PlatformSettings } from "$types/shared/worker/settings-worker.types.ts";

export class ImageChatAttachmentConfig {
	readonly maxFileSize: Signal<number> = signal(1);
	readonly isEnabled: Signal<boolean> = signal(false);
	readonly imagesOnHover: Signal<boolean> = signal(true);
	imageOnHoverSource = "https://enhancer.at/assets/chat-image-hover.png";
	readonly callback: () => Promise<void> | void;

	constructor(
		private settingsService: SettingsService<PlatformSettings>,
		private workerService: WorkerService,
		callback: () => Promise<void> | void,
	) {
		this.callback = callback;
	}

	async initialize() {
		this.maxFileSize.value = await this.settingsService.getSettingsKey("chatImagesSize");
		this.imagesOnHover.value = await this.settingsService.getSettingsKey("chatImagesOnHover");
		this.isEnabled.value = await this.settingsService.getSettingsKey("chatImagesEnabled");

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
