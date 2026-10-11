import type { EmoteBarEntry, UsedEmote } from "$types/platforms/twitch/twitch.emote-bar.types.ts";

const DAY = 24 * 60 * 60 * 1000;

export const EMOTE_BAR_HALF_LIFE = 3 * DAY;
export const EMOTE_BAR_RECENT_WINDOW = 10 * 60 * 1000;
export const EMOTE_BAR_MAX_RECENT = 3;
export const EMOTE_BAR_MAX_ENTRIES = 60;
export const EMOTE_BAR_EXPIRY = 30 * DAY;
export const EMOTE_BAR_MIN_SCORE = 0.05;

export function getScore(entry: EmoteBarEntry, now: number): number {
	return entry.score * 2 ** (-Math.max(0, now - entry.lastUsed) / EMOTE_BAR_HALF_LIFE);
}

export function rankEntries(entries: EmoteBarEntry[], now: number): EmoteBarEntry[] {
	return [...entries].sort(
		(left, right) =>
			getScore(right, now) - getScore(left, now) ||
			right.lastUsed - left.lastUsed ||
			left.name.localeCompare(right.name),
	);
}

export function recordUsage(entries: EmoteBarEntry[], used: UsedEmote[], now: number): EmoteBarEntry[] {
	const next = new Map(entries.map((entry) => [entry.name, { ...entry }]));
	const seen = new Set<string>();
	for (const emote of used) {
		if (seen.has(emote.name)) continue;
		seen.add(emote.name);
		const existing = next.get(emote.name);
		next.set(emote.name, {
			...emote,
			score: (existing ? getScore(existing, now) : 0) + 1,
			lastUsed: now,
		});
	}
	return pruneEntries([...next.values()], now);
}

export function pruneEntries(entries: EmoteBarEntry[], now: number): EmoteBarEntry[] {
	const ranked = rankEntries(
		entries.filter((entry) => getScore(entry, now) >= EMOTE_BAR_MIN_SCORE || now - entry.lastUsed < EMOTE_BAR_EXPIRY),
		now,
	);
	while (ranked.length > EMOTE_BAR_MAX_ENTRIES) {
		const index = ranked.findLastIndex((entry) => !isRecent(entry, now));
		ranked.splice(index === -1 ? ranked.length - 1 : index, 1);
	}
	return ranked;
}

export function selectVisible(
	entries: EmoteBarEntry[],
	now: number,
	available: number,
	widthOf: (entry: EmoteBarEntry) => number,
): EmoteBarEntry[] {
	const ranked = rankEntries(entries, now);
	const selected = new Set<EmoteBarEntry>();
	let used = 0;
	for (const entry of ranked) {
		const width = widthOf(entry);
		if (used + width > available) continue;
		selected.add(entry);
		used += width;
	}

	const recent = ranked
		.filter((entry) => isRecent(entry, now))
		.sort((left, right) => right.lastUsed - left.lastUsed)
		.slice(0, EMOTE_BAR_MAX_RECENT);
	const protectedEntries = new Set(recent);
	for (const entry of recent) {
		if (selected.has(entry)) continue;
		const width = widthOf(entry);
		if (width > available) continue;
		const evictable = ranked.filter((candidate) => selected.has(candidate) && !protectedEntries.has(candidate));
		while (used + width > available && evictable.length > 0) {
			const victim = evictable.pop()!;
			selected.delete(victim);
			used -= widthOf(victim);
		}
		if (used + width > available) continue;
		selected.add(entry);
		used += width;
	}

	return ranked.filter((entry) => selected.has(entry));
}

function isRecent(entry: EmoteBarEntry, now: number): boolean {
	return now - entry.lastUsed <= EMOTE_BAR_RECENT_WINDOW;
}
