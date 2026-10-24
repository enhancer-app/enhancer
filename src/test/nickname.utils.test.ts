import { describe, expect, test } from "bun:test";
import { checkNickname, nicknameFeedback } from "$shared/utils/nickname.utils.ts";
import type { NicknameIssue } from "$types/shared/nickname.types.ts";

const issueOf = (value: string) => checkNickname(value).issue;

describe("checkNickname", () => {
	test.each([
		"igorovh",
		"xQc_The_Juicer_2024",
		"Cool Nick",
		"Łukasz Żółć",
		"Renée",
		"محمد",
		"Игорь",
		"꧁🔥igor🔥꧂",
		"👑🐐🔥💎🚀 king",
		"Tom 1️⃣",
	])("accepts %p", (value) => {
		expect(issueOf(value)).toBeNull();
	});

	test("normalizes whitespace and composes accents", () => {
		expect(checkNickname("  Rene\u0301e   the\tgreat ").value).toBe("Renée the great");
	});

	test("counts what people see, not UTF-16 units", () => {
		expect(checkNickname("👨‍👩‍👧🇵🇱🏴󠁧󠁢󠁥󠁮󠁧󠁿")).toMatchObject({ length: 3, symbols: 3, issue: null });
		expect(issueOf("🔥".repeat(5) + "a".repeat(27))).toBeNull();
	});

	test("rejects empty and over-long nicknames", () => {
		expect(issueOf("   ")).toBe("EMPTY");
		expect(issueOf("a".repeat(33))).toBe("TOO_LONG");
	});

	test.each(["﷽﷽﷽﷽﷽﷽", "🔥🔥🔥🔥🔥🔥", "𒐫𒐫𒐫𒐫𒐫𒐫", "꧁꧂꧁꧂ 🔥🔥", "௵௸௵௸௵௸"])(
		"rejects more than five symbols in %p",
		(value) => {
			expect(issueOf(value)).toBe("TOO_MANY_SYMBOLS");
		},
	);

	test("rejects stacked accent marks", () => {
		expect(issueOf("h\u0327\u0337\u0322\u031b\u0316e")).toBe("STACKED_MARKS");
	});

	// q has no precomposed forms with these marks, so NFC keeps every mark separate.
	test("allows two marks per character and rejects the third", () => {
		expect(issueOf("q\u0316\u0317")).toBeNull();
		expect(issueOf("q\u0316\u0317\u0318")).toBe("STACKED_MARKS");
	});

	test.each<[string, string, NicknameIssue]>([
		["the first per-character issue", "q\u0316\u0317\u0318\u200b", "STACKED_MARKS"],
		["the first per-character issue", "\u200bq\u0316\u0317\u0318", "INVISIBLE_CHARACTERS"],
		["character issues over length", `ig\u200bor${"a".repeat(40)}`, "INVISIBLE_CHARACTERS"],
		["raw size over length", "é".repeat(70), "TOO_LARGE"],
		["length over symbols", "🔥".repeat(6) + "a".repeat(30), "TOO_LONG"],
	])("reports %s first (%p)", (_, value, expected) => {
		expect(issueOf(value)).toBe(expected);
	});

	test.each(["igor\u202e", "ig\u200bor", "\u3164", "a\u2800b", "ig\u200dor"])(
		"rejects invisible characters in %p",
		(value) => {
			expect(issueOf(value)).toBe("INVISIBLE_CHARACTERS");
		},
	);

	test("caps raw size even when the visible length fits", () => {
		expect(issueOf("a\u0325\u0308".repeat(32))).toBe("TOO_LARGE");
	});
});

describe("nicknameFeedback", () => {
	test("counts characters and symbols without flagging an empty field", () => {
		expect(nicknameFeedback("")).toEqual({ hint: "0/32 characters · 0/5 emoji or symbols" });
	});

	test("explains the first broken rule", () => {
		expect(nicknameFeedback("a".repeat(33)).error).toBe("Nickname must be at most 32 characters");
	});
});
