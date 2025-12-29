import KickApi from "$kick/apis/kick.api.ts";
import type KickModule from "$kick/kick.module.ts";
import KickUtils from "$kick/kick.utils.ts";
import AdditionalFontsModule from "$kick/modules/additional-fonts/additional-fonts.module.tsx";
import ChannelSectionModule from "$kick/modules/channel-section/channel-section.module.tsx";
import ChatAttachmentsModule from "$kick/modules/chat-attachments/chat-attachments.module.ts";
import ChatBadgesModule from "$kick/modules/chat-badges/chat-badges.module.tsx";
import ChatFixAutoScrollModule from "$kick/modules/chat-fix-auto-scroll/chat-fix-auto-scroll.module.tsx";
import ChatHighlightUserModule from "$kick/modules/chat-highlight-user/chat-highlight-user.module.tsx";
import ChatMessagePopupModule from "$kick/modules/chat-message-popup/chat-message-popup.module.tsx";
import ChatNicknameCustomizationModule from "$kick/modules/chat-nickname-customization/chat-nickname-customization.module.ts";
import ChatModule from "$kick/modules/chat/chat.module.ts";
import LocalWatchtimeCounterModule from "$kick/modules/local-watchtime-counter/local-watchtime-counter.module.tsx";
import RealVideoTimeModule from "$kick/modules/real-video-time/real-video-time.module.tsx";
import SettingsButtonModule from "$kick/modules/settings-button/settings-button.module.tsx";
import SettingsModule from "$kick/modules/settings/settings.module.tsx";
import SharedFollowsModule from "$kick/modules/shared-follows/shared-follows.module.tsx";
import StreamLatencyModule from "$kick/modules/stream-latency/stream-latency.module.tsx";
import Platform from "$shared/platform/platform.ts";
import type { KickEvents } from "$types/platforms/kick/kick.events.types.ts";
import type { KickSettings } from "$types/platforms/kick/kick.settings.types.ts";
import type { KickStorage } from "$types/platforms/kick/kick.storage.types.ts";

export default class KickPlatform extends Platform<KickModule, KickEvents, KickStorage, KickSettings> {
	constructor() {
		super({ type: "kick" });
	}

	private readonly kickUtils = new KickUtils(this.utilsRepository.reactUtils, this.utilsRepository.commonUtils);
	private readonly kickApi = new KickApi();

	protected getModules(): KickModule[] {
		const dependencies = [
			this.emitter,
			this.storageRepository,
			this.settingsService,
			this.commonDataService,
			this.utilsRepository,
			this.enhancerApi,
			this.workerApi,
			this.kickUtils,
			this.kickApi,
		] as const;
		return [
			new ChatModule(...dependencies),
			new ChatAttachmentsModule(...dependencies),
			new ChatBadgesModule(...dependencies),
			new SettingsButtonModule(...dependencies),
			new SettingsModule(...dependencies),
			new ChatNicknameCustomizationModule(...dependencies),
			new StreamLatencyModule(...dependencies),
			new RealVideoTimeModule(...dependencies),
			new ChannelSectionModule(...dependencies),
			new LocalWatchtimeCounterModule(...dependencies),
			new ChatHighlightUserModule(...dependencies),
			new ChatMessagePopupModule(...dependencies),
			// new MessageMenuModule(...dependencies),
			// new ChatMessageMenuModule(...dependencies),
			new AdditionalFontsModule(...dependencies),
			new ChatFixAutoScrollModule(...dependencies),
			new SharedFollowsModule(...dependencies),
		];
	}

	shouldStart(location: Location): boolean {
		return location.hostname !== "docs.kick.com";
	}
}
