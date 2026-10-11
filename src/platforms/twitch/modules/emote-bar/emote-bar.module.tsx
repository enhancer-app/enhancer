import EmotesApi from "$shared/apis/emotes.api.ts";
import TwitchModule from "$twitch/twitch.module.ts";
import type {
	EmoteBarEntry,
	EmoteCatalog,
	TwilightUser,
	UsedEmote,
} from "$types/platforms/twitch/twitch.emote-bar.types.ts";
import type { TwitchChatMessageEvent } from "$types/platforms/twitch/twitch.events.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import { signal } from "@preact/signals";
import { render } from "preact";
import EmoteBarCatalog, { getProviderFromUrl } from "./emote-bar.catalog.ts";
import { EmoteBarComponent } from "./emote-bar.component.tsx";
import { recordUsage } from "./emote-bar.frecency.ts";
import EmoteBarStorage from "./emote-bar.storage.ts";

export default class EmoteBarModule extends TwitchModule {
	static readonly EMOTE_SELECTOR = [
		"img.chat-line__message--emote",
		"img.seventv-chat-emote",
		"img.seventv-emote",
		"img.ffz-emote",
		"img.bttv-emote-image",
	].join(", ");
	private static readonly EXTRACT_RETRIES = 3;
	private static readonly EXTRACT_RETRY_DELAY = 400;
	private static readonly CATALOG_DELAY = 10_000;
	private static readonly DUPLICATE_WINDOW = 30_000;
	private static readonly DUPLICATE_BYPASS = "\u034F";
	private static readonly MAX_PROCESSED_MESSAGES = 200;

	private readonly storage = new EmoteBarStorage();
	private readonly entries = signal<EmoteBarEntry[]>([]);
	private readonly catalogSignal = signal<EmoteCatalog | null>(null);
	private readonly processedMessages = new Set<string>();
	private catalog: EmoteBarCatalog | null = null;
	private catalogTimeout: ReturnType<typeof setTimeout> | undefined;
	private channelId = "";
	private currentUser: TwilightUser | null = null;
	private lastSent: { name: string; at: number; bypass: boolean } | null = null;

	readonly config: TwitchModuleConfig = {
		name: "emote-bar",
		appliers: [
			{
				type: "selector",
				key: "emote-bar",
				selectors: [".chat-input__textarea"],
				callback: this.run.bind(this),
				once: true,
			},
			{
				type: "event",
				key: "emote-bar-channel",
				event: "twitch:chatInitialized",
				callback: this.setChannel.bind(this),
			},
			{
				type: "event",
				key: "emote-bar-message",
				event: "twitch:chatMessage",
				callback: this.handleMessage.bind(this),
			},
		],
		enabled: () => this.settings().emoteBarEnabled,
	};

	initialize() {
		this.catalog = new EmoteBarCatalog(new EmotesApi(), this.logger);
		this.storage.onChange(() => {
			if (this.channelId) this.entries.value = this.storage.getEntries(this.channelId);
		});
	}

	private run(elements: Element[]) {
		const channelId = this.twitchUtils().getChatController()?.props.channelID;
		if (channelId) this.setChannel(channelId);
		for (const element of elements) {
			if (!element.parentElement) continue;
			const wrapper = document.createElement("div");
			wrapper.className = this.getId();
			element.parentElement.insertBefore(wrapper, element);
			render(
				<EmoteBarComponent
					entries={this.entries}
					catalog={this.catalogSignal}
					onInsert={(name) => this.twitchUtils().addTextToChatInput(name)}
					onSend={(name) => this.sendEmote(name)}
					onRemove={(name) => this.updateEntries((entries) => entries.filter((entry) => entry.name !== name))}
					onRatio={(name, ratio) =>
						this.updateEntries((entries) => entries.map((entry) => (entry.name === name ? { ...entry, ratio } : entry)))
					}
				/>,
				wrapper,
			);
		}
	}

	private setChannel(channelId: string) {
		if (!channelId || channelId === this.channelId) return;
		this.channelId = channelId;
		this.currentUser = null;
		this.entries.value = this.storage.getEntries(channelId);
		this.catalogSignal.value = null;
		clearTimeout(this.catalogTimeout);
		if (this.entries.value.some((entry) => entry.provider !== "twitch")) {
			this.catalogTimeout = setTimeout(() => void this.loadCatalog(channelId), EmoteBarModule.CATALOG_DELAY);
		}
	}

	private async loadCatalog(channelId: string) {
		if (!this.catalog || channelId !== this.channelId) return;
		const user = this.getCurrentUser();
		try {
			const catalog = await this.catalog.load({
				channelId,
				channelLogin:
					this.twitchUtils().getChatController()?.props.channelLogin ?? this.twitchUtils().getCurrentChannelByUrl(),
				userId: user.id,
				userLogin: user.login,
				is7TV: !!this.twitchUtils().is7TV(),
			});
			if (channelId === this.channelId) this.catalogSignal.value = catalog;
		} catch (error) {
			this.logger.warn("Failed to load emote catalog", error);
		}
	}

	private async handleMessage({ message, element, isReplay }: TwitchChatMessageEvent) {
		if (isReplay || message.isHistorical || !this.channelId) return;
		const login = this.getCurrentUser().login;
		if (!login || message.user?.userLogin?.toLowerCase() !== login) return;
		const keys = [message.id, message.nonce].filter(Boolean);
		if (keys.some((key) => this.processedMessages.has(key))) return;
		for (const key of keys) this.processedMessages.add(key);
		if (this.processedMessages.size > EmoteBarModule.MAX_PROCESSED_MESSAGES) {
			this.processedMessages.delete(this.processedMessages.values().next().value!);
		}

		const channelId = this.channelId;
		let emotes = this.extractEmotes(element);
		for (let attempt = 0; emotes.length === 0 && attempt < EmoteBarModule.EXTRACT_RETRIES; attempt++) {
			await this.commonUtils().delay(EmoteBarModule.EXTRACT_RETRY_DELAY);
			emotes = this.extractEmotes(element);
		}
		if (emotes.length === 0 || channelId !== this.channelId) return;
		this.updateEntries((entries) => recordUsage(entries, emotes, Date.now()));
	}

	private extractEmotes(element: Element): UsedEmote[] {
		const emotes = new Map<string, UsedEmote>();
		for (const image of element.querySelectorAll<HTMLImageElement>(EmoteBarModule.EMOTE_SELECTOR)) {
			if (/zero-width|overlay/i.test(image.className)) continue;
			const name = (image.alt || image.dataset.emoteName || "").trim();
			const src = this.resolveImageSource(image);
			const provider = src ? getProviderFromUrl(src) : null;
			if (!name || !src || !provider || emotes.has(name)) continue;
			const width = image.naturalWidth || image.width;
			const height = image.naturalHeight || image.height;
			emotes.set(name, { name, src, provider, ratio: width && height ? width / height : 1 });
		}
		return [...emotes.values()];
	}

	private resolveImageSource(image: HTMLImageElement): string {
		const source = image.currentSrc || image.src || image.srcset.split(",")[0]?.trim().split(/\s+/)[0] || "";
		return source.startsWith("//") ? `https:${source}` : source;
	}

	private updateEntries(updater: (entries: EmoteBarEntry[]) => EmoteBarEntry[]) {
		if (!this.channelId) return;
		this.entries.value = this.storage.update(this.channelId, updater);
	}

	private sendEmote(name: string) {
		const now = Date.now();
		const repeated = this.lastSent?.name === name && now - this.lastSent.at < EmoteBarModule.DUPLICATE_WINDOW;
		const bypass = repeated ? !this.lastSent!.bypass : false;
		this.lastSent = { name, at: now, bypass };
		this.twitchUtils()
			.getChat()
			?.props.onSendMessage(bypass ? `${name} ${EmoteBarModule.DUPLICATE_BYPASS}` : name);
	}

	private getCurrentUser(): TwilightUser {
		if (!this.currentUser) this.currentUser = this.readCurrentUser();
		return this.currentUser;
	}

	private readCurrentUser(): TwilightUser {
		try {
			const user = JSON.parse(localStorage.getItem("twilight-user") ?? "null") as TwilightUser | null;
			if (user?.login) return { id: user.id, login: user.login.toLowerCase() };
		} catch {}
		const login =
			document.cookie.match(/(?:^|;\s*)login=([^;]+)/)?.[1] ??
			this.twitchUtils().getScrollableChat()?.props.currentUserLogin;
		return { login: login ? decodeURIComponent(login).toLowerCase() : undefined };
	}
}
