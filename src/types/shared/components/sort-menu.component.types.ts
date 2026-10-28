import type { ComponentChildren } from "preact";

export type SortMenuTheme = "home" | "twitch" | "kick";

export interface SortMenuComponentProps<T extends string> {
	value: T;
	options: T[];
	labels: Record<T, string>;
	onChange: (value: T) => void;
	theme: SortMenuTheme;
	label: string;
	align?: "start" | "end";
	renderTrigger: (open: boolean) => ComponentChildren;
}
