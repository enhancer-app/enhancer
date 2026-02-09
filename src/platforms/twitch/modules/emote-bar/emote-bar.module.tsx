import TwitchModule from "$twitch/twitch.module.ts";
import type { TwitchChatMessageEvent } from "$types/platforms/twitch/twitch.events.types.ts";
import type { EmoteItem } from "$types/platforms/twitch/twitch.utils.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import { type Signal, signal } from "@preact/signals";
import { render } from "preact";
import styled from "styled-components";

export default class EmoteBarModule extends TwitchModule {
	private emotes: Signal<EmoteItem[]> = signal([]);

	private ctrlWindowStartTs: number | null = null;
	private ctrlAppendCount = 0;
	private readonly INVISIBLE_CHAR = "\u034F";

	readonly config: TwitchModuleConfig = {
		name: "emote-bar",
		appliers: [
			{
				type: "selector",
				selectors: [".chat-list--default"],
				callback: this.run.bind(this),
				key: "emote-bar",
				once: true,
			},
			{
				type: "event",
				key: "emote-bar",
				event: "twitch:chatMessage",
				callback: this.handleMessage.bind(this),
			},
		],
		isModuleEnabledCallback: async () => await this.settingsService().getSettingsKey("emoteBarEnabled"),
	};

	private async handleMessage(event: TwitchChatMessageEvent) {
		if (event.message.user.userLogin !== this.twitchUtils().getScrollableChat()?.props.currentUserLogin) return;
		const emoteImages = event.element.querySelectorAll<HTMLImageElement>(
			"img.chat-line__message--emote, img.seventv-chat-emote",
		);
		if (emoteImages.length === 0) return;

		const newEmotes: EmoteItem[] = Array.from(emoteImages)
			.map((img) => {
				const src = this.resolveImageSource(img);
				if (!src) return null;
				const w = img.naturalWidth || img.width;
				const h = img.naturalHeight || img.height;
				const isWide = h > 0 && w / h > 1;
				return { src, alt: img.alt || "", isWide } as EmoteItem;
			})
			.filter((e): e is EmoteItem => e !== null);
		await this.appendEmotes(newEmotes);
	}

	private resolveImageSource(img: HTMLImageElement): string {
		const { src } = img;
		if (src) return src;

		const current = img.currentSrc;
		if (current) return current;
		const srcset = img.getAttribute("srcset");
		if (srcset) {
			const parts = srcset.split(",")[0]?.trim().split(/\s+/);
			if (parts?.[0]) {
				const url = parts[0];
				return url.startsWith("//") ? `${window.location.protocol}${url}` : url;
			}
		}
		return "";
	}

	private async appendEmotes(newEmotes: EmoteItem[]) {
		const MAX_SLOTS = 18;
		if (newEmotes.length === 0) return;

		const uniqueNew = this.getUniqueEmotes(newEmotes);
		const current = [...this.emotes.value];

		const replacedAlts = this.updateExistingEmotes(current, uniqueNew);

		let usedSlots = this.countUsedSlots(current);

		if (usedSlots < MAX_SLOTS) {
			for (const emote of uniqueNew) {
				if (this.shouldSkipEmote(emote, current, replacedAlts)) continue;

				const cost = emote.isWide ? 2 : 1;
				if (usedSlots + cost > MAX_SLOTS) break;

				current.push(emote);
				usedSlots += cost;
			}
			this.emotes.value = current;
			await this.persist();
			return;
		}

		const trulyNew = uniqueNew.filter((e) => !this.shouldSkipEmote(e, current, replacedAlts));

		if (trulyNew.length === 0) return;

		const combined = [
			...trulyNew,
			...current.filter((e) => !trulyNew.some((n) => n.src === e.src || (n.alt && e.alt === n.alt))),
		];

		const result: EmoteItem[] = [];
		let used = 0;
		let column = 0;

		for (const item of combined) {
			const weight = item.isWide ? 2 : 1;
			if (used + weight > MAX_SLOTS) break;

			if (weight === 2 && column % 9 === 8) continue;

			result.push(item);
			used += weight;
			column += weight;
		}

		this.emotes.value = result;
		await this.persist();
	}

	private async run(elements: Element[]) {
		const wrappers = this.commonUtils().createEmptyElements(this.getId(), elements, "div");

		await this.commonUtils().waitFor(
			() => this.getChannelKey(),
			async () => {
				await this.loadPersisted();
				return true;
			},
			{ maxRetries: 10, delay: 100 },
		);

		wrappers.forEach((element) => {
			render(
				<EmoteBar
					emotes={this.emotes}
					onInsert={(name) => this.twitchUtils().addTextToChatInput(name)}
					onSend={(name) => this.sendEmote(name)}
				/>,
				element,
			);
		});
	}

	private getChannelKey(): string {
		return this.twitchUtils().getScrollableChat()?.props.channelID || "";
	}

	private async loadPersisted() {
		const storage = (await this.localStorage().get("emoteBarByChannel")) || ({} as Record<string, EmoteItem[]>);
		const key = this.getChannelKey();
		const loaded = storage[key] || [];

		let filtered = loaded;
		try {
			filtered = await this.filterEmotesAgainstChannel(loaded);
		} catch {}

		const changed = loaded.length !== filtered.length || loaded.some((e) => !filtered.some((f) => f.src === e.src));

		this.emotes.value = filtered;
		if (changed) {
			await this.persist();
		}
	}

	private async filterEmotesAgainstChannel(emotes: EmoteItem[]): Promise<EmoteItem[]> {
		if (emotes.length === 0) return emotes;

		const info = this.twitchUtils().getChannelInfo() || this.twitchUtils().getChannelInfoFromHomeLowerContent();
		const username = info?.channelLogin || this.twitchUtils().getCurrentChannelByUrl();
		if (!username) return emotes;
		const allowed = new Set();
		try {
			const globals = await this.enhancerApi().getGlobalEmotes();
			const channel = await this.enhancerApi().getChannelEmotes(username);
			for (const code of globals) allowed.add(code);
			for (const code of channel) allowed.add(code);
		} catch (error) {
			this.logger.warn("Failed to fetch global emotes:", error);
		}
		return emotes.filter((e) => !!e.alt && allowed.has(e.alt));
	}

	private sendEmote(name: string): void {
		const now = Date.now();
		if (this.ctrlWindowStartTs === null || now - this.ctrlWindowStartTs > 30_000) {
			this.ctrlWindowStartTs = now;
			this.ctrlAppendCount = 1;
		} else {
			this.ctrlAppendCount += 1;
		}
		const message = `${name} ${this.INVISIBLE_CHAR.repeat(this.ctrlAppendCount)}`;
		this.twitchUtils().getChat()?.props.onSendMessage(message);
	}

	private async persist() {
		const key = this.getChannelKey();
		const storage = (await this.localStorage().get("emoteBarByChannel")) || ({} as Record<string, EmoteItem[]>);
		storage[key] = this.emotes.value;
		await this.localStorage().save("emoteBarByChannel", storage);
	}

	private getUniqueEmotes(emotes: EmoteItem[]): EmoteItem[] {
		const seen = new Set<string>();
		return emotes.filter((e) => {
			const key = e.alt || e.src;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});
	}

	private updateExistingEmotes(current: EmoteItem[], newEmotes: EmoteItem[]): Set<string> {
		const replaced = new Set<string>();
		for (const emote of newEmotes) {
			if (!emote.alt) continue;

			const idx = current.findIndex((e) => e.alt === emote.alt);
			if (idx >= 0) {
				if (current[idx].src !== emote.src) {
					current[idx] = { ...current[idx], src: emote.src };
				}
				replaced.add(emote.alt);
			}
		}
		return replaced;
	}

	private countUsedSlots(emotes: EmoteItem[]): number {
		return emotes.reduce((sum, e) => sum + (e.isWide ? 2 : 1), 0);
	}

	private shouldSkipEmote(emote: EmoteItem, current: EmoteItem[], replaced: Set<string>): boolean {
		if (replaced.has(emote.alt || "")) return true;
		if (emote.alt && current.some((e) => e.alt === emote.alt)) return true;
		return current.some((e) => e.src === emote.src);
	}
}

const EmoteBarWrapper = styled.div`
	margin: 8px 0;
	background: #18181b;
	border: 0;
	padding: 6px 8px;
	color: #efeff1;
	display: flex;
	flex-wrap: wrap;

	align-items: center;
	gap: 8px 10px;

	/* Still enforces the 2-row limit */
	height: 92px; /* 36(row) + 8(gap) + 36(row) + 6(pad) + 6(pad) */
	overflow: hidden;

	border-top: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 6px;
`;

const EmoteImage = styled.img`
	/* Width is now 'auto' by default */
	height: 28px; /* All images will have this height */
	object-fit: contain;
	cursor: pointer;
	flex-shrink: 0;
`;

function EmoteBar({
	emotes,
	onInsert,
	onSend,
}: { emotes: Signal<EmoteItem[]>; onInsert: (alt: string) => void; onSend: (alt: string) => void }) {
	// Note: Your 'EmoteItem' type no longer needs the 'isWide' property

	return (
		<EmoteBarWrapper>
			{emotes.value.map((item, index) => (
				<EmoteImage
					key={`${item.src}-${index}`}
					src={item.src}
					alt={item.alt}
					onClick={(e) => (e.ctrlKey ? onSend(item.alt) : onInsert(item.alt))}
					/* The inline 'style' prop is gone! */
				/>
			))}
		</EmoteBarWrapper>
	);
}
