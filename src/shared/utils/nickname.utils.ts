import type { NicknameCheck, NicknameFeedback, NicknameIssue } from "$types/shared/nickname.types.ts";

// Copied from enhancer-app/workspace packages/utils/src/nickname.ts; the API re-checks on submit.
export const NICKNAME_MAX_LENGTH = 32;
export const NICKNAME_MAX_SYMBOLS = 5;
const NICKNAME_MAX_MARKS_PER_CHARACTER = 2;
const NICKNAME_MAX_BYTES = 128;

export const NICKNAME_ISSUE_MESSAGES: Record<NicknameIssue, string> = {
	EMPTY: "Nickname must not be empty",
	TOO_LONG: `Nickname must be at most ${NICKNAME_MAX_LENGTH} characters`,
	TOO_MANY_SYMBOLS: `Nicknames can contain at most ${NICKNAME_MAX_SYMBOLS} emoji or decorative symbols`,
	STACKED_MARKS: "Nickname contains stacked accent marks",
	INVISIBLE_CHARACTERS: "Nickname contains invisible or control characters",
	TOO_LARGE: "Nickname is too large",
};

const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u;
const MARK = /\p{M}/gu;
const INVISIBLE = /[\p{Cc}\p{Cf}\u115F\u1160\u2800\u3164\uFFA0]/u;
const EMOJI_FORMAT = /[\u200D\u{E0020}-\u{E007F}]/gu;

const OVERSIZED: ReadonlyArray<readonly [number, number]> = [
	[0x0bf3, 0x0bfa],
	[0x2e3a, 0x2e3b],
	[0xa9c1, 0xa9cd],
	[0xfb50, 0xfdff],
	[0xfe70, 0xfeff],
	[0x12000, 0x1254f],
	[0x13000, 0x1345f],
	[0x1d000, 0x1d24f],
];

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

function isOversized(character: string): boolean {
	for (const symbol of character) {
		const code = symbol.codePointAt(0) ?? 0;
		if (OVERSIZED.some(([from, to]) => code >= from && code <= to)) return true;
	}
	return false;
}

export function normalizeNicknameInput(raw: string): string {
	return raw.normalize("NFC").trim().replace(/\s+/g, " ");
}

export function checkNickname(raw: string): NicknameCheck {
	const value = normalizeNicknameInput(raw);
	const characters = [...segmenter.segment(value)].map((part) => part.segment);
	let symbols = 0;
	let issue: NicknameIssue | null = null;
	const flag = (next: NicknameIssue) => {
		issue ??= next;
	};

	for (const character of characters) {
		const emoji = EMOJI.test(character);
		if (emoji || isOversized(character)) symbols += 1;
		const visible = emoji ? character.replace(EMOJI_FORMAT, "") : character;
		if (INVISIBLE.test(visible)) flag("INVISIBLE_CHARACTERS");
		if (!emoji && (character.match(MARK)?.length ?? 0) > NICKNAME_MAX_MARKS_PER_CHARACTER) flag("STACKED_MARKS");
	}

	if (characters.length === 0) flag("EMPTY");
	if (new TextEncoder().encode(value).length > NICKNAME_MAX_BYTES) flag("TOO_LARGE");
	if (characters.length > NICKNAME_MAX_LENGTH) flag("TOO_LONG");
	if (symbols > NICKNAME_MAX_SYMBOLS) flag("TOO_MANY_SYMBOLS");

	return { value, length: characters.length, symbols, issue };
}

export function nicknameFeedback(value: string): NicknameFeedback {
	const check = checkNickname(value);
	const hint = `${check.length}/${NICKNAME_MAX_LENGTH} characters · ${check.symbols}/${NICKNAME_MAX_SYMBOLS} emoji or symbols`;
	if (!check.issue || check.issue === "EMPTY") return { hint };
	return { hint, error: NICKNAME_ISSUE_MESSAGES[check.issue] };
}
