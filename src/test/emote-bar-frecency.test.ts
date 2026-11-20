import { expect, test } from "bun:test";
import {
	EMOTE_BAR_EXPIRY,
	EMOTE_BAR_HALF_LIFE,
	EMOTE_BAR_MAX_ENTRIES,
	EMOTE_BAR_RECENT_WINDOW,
	getScore,
	pruneEntries,
	rankEntries,
	recordUsage,
	selectVisible,
} from "$twitch/modules/emote-bar/emote-bar.frecency.ts";
import type { EmoteBarEntry, UsedEmote } from "$types/platforms/twitch/twitch.emote-bar.types.ts";

const HOUR = 60 * 60 * 1000;

function used(name: string, ratio = 1): UsedEmote {
	return { name, src: `https://cdn.7tv.app/emote/${name}/1x.webp`, provider: "7tv", ratio };
}

function useMany(entries: EmoteBarEntry[], name: string, times: number, start: number, step = HOUR) {
	let next = entries;
	for (let index = 0; index < times; index++) next = recordUsage(next, [used(name)], start + index * step);
	return next;
}

const names = (entries: EmoteBarEntry[]) => entries.map((entry) => entry.name);
const unitWidth = () => 10;

test("counts an emote once per message", () => {
	const entries = recordUsage([], [used("KEKW"), used("KEKW"), used("KEKW")], 0);

	expect(entries).toHaveLength(1);
	expect(entries[0].score).toBe(1);
});

test("halves an unused score every half-life", () => {
	const [entry] = recordUsage([], [used("KEKW")], 0);

	expect(getScore(entry, EMOTE_BAR_HALF_LIFE)).toBeCloseTo(0.5);
	expect(getScore(entry, 2 * EMOTE_BAR_HALF_LIFE)).toBeCloseTo(0.25);
});

test("keeps a frequently used emote above a single newer use", () => {
	let entries = useMany([], "OMEGALUL", 10, 0);
	entries = recordUsage(entries, [used("Pog")], 11 * HOUR);

	expect(names(rankEntries(entries, 11 * HOUR))).toEqual(["OMEGALUL", "Pog"]);
});

test("lets a stale favourite fall below emotes used recently and often", () => {
	let entries = useMany([], "OldFavourite", 10, 0);
	const later = 4 * EMOTE_BAR_HALF_LIFE;
	entries = useMany(entries, "NewFavourite", 3, later);

	expect(names(rankEntries(entries, later + 3 * HOUR))).toEqual(["NewFavourite", "OldFavourite"]);
});

test("shows a just-used emote even when the bar is full of higher scores", () => {
	let entries: EmoteBarEntry[] = [];
	for (const name of ["A", "B", "C", "D"]) entries = useMany(entries, name, 5, 0);
	const now = 5 * HOUR + EMOTE_BAR_RECENT_WINDOW + 1;
	entries = recordUsage(entries, [used("New")], now);

	const visible = selectVisible(entries, now, 40, unitWidth);

	expect(visible).toHaveLength(4);
	expect(names(visible)).toContain("New");
	expect(names(visible).at(-1)).toBe("New");
});

test("returns the just-used emote to its frecency position after the recent window", () => {
	let entries: EmoteBarEntry[] = [];
	for (const name of ["A", "B", "C", "D"]) entries = useMany(entries, name, 5, 0);
	const usedAt = 5 * HOUR;
	entries = recordUsage(entries, [used("New")], usedAt);

	const visible = selectVisible(entries, usedAt + EMOTE_BAR_RECENT_WINDOW + 1, 40, unitWidth);

	expect(names(visible)).not.toContain("New");
});

test("accounts for wide emotes when fitting the bar", () => {
	let entries = useMany([], "Wide", 3, 0);
	entries = useMany(entries, "Narrow", 2, 0);
	entries = useMany(entries, "Tiny", 1, 0);
	const widthOf = (entry: EmoteBarEntry) => (entry.name === "Wide" ? 30 : 10);

	expect(names(selectVisible(entries, 3 * HOUR + EMOTE_BAR_RECENT_WINDOW, 40, widthOf))).toEqual(["Wide", "Narrow"]);
});

test("caps stored entries without dropping recently used emotes", () => {
	let entries: EmoteBarEntry[] = [];
	for (let index = 0; index < EMOTE_BAR_MAX_ENTRIES; index++) entries = useMany(entries, `Emote${index}`, 3, 0);
	const now = 3 * HOUR + EMOTE_BAR_RECENT_WINDOW + 1;
	entries = recordUsage(entries, [used("Fresh")], now);

	expect(entries).toHaveLength(EMOTE_BAR_MAX_ENTRIES);
	expect(names(entries)).toContain("Fresh");
});

test("prunes emotes that decayed and expired", () => {
	const entries = recordUsage([], [used("Gone")], 0);

	expect(pruneEntries(entries, EMOTE_BAR_EXPIRY + 1)).toEqual([]);
	expect(pruneEntries(entries, EMOTE_BAR_EXPIRY - 1)).toHaveLength(1);
});
