import { expect, test } from "bun:test";
import { formatMomentCountdown, pickBadgeImage, remainingRatio } from "$shared/moments/moment-countdown.ts";

test("formats the remaining time in hours and minutes", () => {
	const now = Date.parse("2026-01-01T00:00:00.000Z");
	const at = (seconds: number) => new Date(now + seconds * 1000).toISOString();
	expect(formatMomentCountdown(at(2 * 3600 + 14 * 60 + 59), now).text).toBe("2h 14m left");
	expect(formatMomentCountdown(at(3600), now).text).toBe("1h left");
	expect(formatMomentCountdown(at(44 * 60 + 30), now).text).toBe("44m left");
	expect(formatMomentCountdown(at(60), now).text).toBe("1m left");
});

test("switches to seconds in the last minute", () => {
	const now = Date.parse("2026-01-01T00:00:00.000Z");
	expect(formatMomentCountdown(new Date(now + 45_000).toISOString(), now)).toEqual({ ended: false, text: "45s left" });
	expect(formatMomentCountdown(new Date(now + 200).toISOString(), now).text).toBe("1s left");
});

test("marks past and invalid end dates as ended", () => {
	const now = Date.parse("2026-01-01T00:00:00.000Z");
	expect(formatMomentCountdown(new Date(now - 1000).toISOString(), now)).toEqual({ ended: true, text: "Ended" });
	expect(formatMomentCountdown(new Date(now).toISOString(), now)).toEqual({ ended: true, text: "Ended" });
	expect(formatMomentCountdown("not-a-date", now)).toEqual({ ended: true, text: "Ended" });
});

test("picks the highest resolution badge image", () => {
	expect(pickBadgeImage({ "1x": "a", "2x": "b", "4x": "c" })).toBe("c");
	expect(pickBadgeImage({ "1x": "a", "2x": "b" })).toBe("b");
	expect(pickBadgeImage({ "1x": "a" })).toBe("a");
	expect(pickBadgeImage({ custom: "z" })).toBe("z");
	expect(pickBadgeImage({ "18x18": "s", "72x72": "l", "36x36": "m" })).toBe("l");
	expect(pickBadgeImage({})).toBeNull();
});

test("reports the remaining share of the moment for the time bar", () => {
	const start = "2026-01-01T00:00:00.000Z";
	const end = "2026-01-01T01:00:00.000Z";
	expect(remainingRatio(start, end, Date.parse("2026-01-01T00:15:00.000Z"))).toBe(0.75);
	expect(remainingRatio(start, end, Date.parse("2026-01-01T02:00:00.000Z"))).toBe(0);
	expect(remainingRatio(end, start)).toBeNull();
});
