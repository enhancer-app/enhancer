import type { Signal } from "@preact/signals";

export type RealVideoTimeDateMode = "hover" | "always" | "never";

export type RealVideoTimeComponentProps = {
	time: Signal<number>;
	dateMode: Signal<RealVideoTimeDateMode>;
	formatTime: (timeInMs: number) => string;
	formatDate: (timeInMs: number) => string;
};

export type VisibleRealVideoTimeComponentProps = RealVideoTimeComponentProps & {
	visibility: Signal<boolean>;
};
