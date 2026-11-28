import type { EmoteBarChannel, EmoteBarEntry, EmoteBarStore } from "$types/platforms/twitch/twitch.emote-bar.types.ts";

const CHANNEL_EXPIRY = 60 * 24 * 60 * 60 * 1000;

export default class EmoteBarStorage {
	static readonly KEY = "enhancer:twitch-emote-bar";

	getEntries(channelId: string): EmoteBarEntry[] {
		return this.read()[channelId]?.entries ?? [];
	}

	update(channelId: string, updater: (entries: EmoteBarEntry[]) => EmoteBarEntry[]): EmoteBarEntry[] {
		const now = Date.now();
		const store = this.read();
		const entries = updater(store[channelId]?.entries ?? []);
		const next: EmoteBarStore = { [channelId]: { entries, updatedAt: now } };
		for (const [id, channel] of Object.entries(store)) {
			if (id !== channelId && now - channel.updatedAt < CHANNEL_EXPIRY) next[id] = channel;
		}
		localStorage.setItem(EmoteBarStorage.KEY, JSON.stringify(next));
		return entries;
	}

	onChange(callback: () => void): () => void {
		const listener = (event: StorageEvent) => {
			if (event.key === EmoteBarStorage.KEY) callback();
		};
		window.addEventListener("storage", listener);
		return () => window.removeEventListener("storage", listener);
	}

	private read(): EmoteBarStore {
		try {
			const parsed = JSON.parse(localStorage.getItem(EmoteBarStorage.KEY) ?? "{}");
			return parsed && typeof parsed === "object" ? (parsed as Record<string, EmoteBarChannel>) : {};
		} catch {
			return {};
		}
	}
}
