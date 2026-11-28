export type NicknameIssue =
	| "EMPTY"
	| "TOO_LONG"
	| "TOO_MANY_SYMBOLS"
	| "STACKED_MARKS"
	| "INVISIBLE_CHARACTERS"
	| "TOO_LARGE";

export type NicknameCheck = {
	value: string;
	length: number;
	symbols: number;
	issue: NicknameIssue | null;
};

export type NicknameFeedback = {
	hint: string;
	error?: string;
};
