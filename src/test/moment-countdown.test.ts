import { expect, test } from "bun:test";
import { formatMomentCountdown, pickBadgeImage } from "$shared/moments/moment-countdown.ts";

test("formats countdown under an hour as minutes and seconds", () => {
	const now = Date.parse("2026-01-01T00:00:00.000Z");
	const endsAt = new Date(now + (5 * 60 + 7) * 1000).toISOString();
	expect(formatMomentCountdown(endsAt, now)).toEqual({ ended: false, text: "5:07 left" });
});

test("formats countdown over an hour with hours", () => {
	const now = Date.parse("2026-01-01T00:00:00.000Z");
	const endsAt = new Date(now + (61 * 60 + 5) * 1000).toISOString();
	expect(formatMomentCountdown(endsAt, now)).toEqual({ ended: false, text: "1:01:05 left" });
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
	expect(pickBadgeImage({})).toBeNull();
});
