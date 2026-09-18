import type { Signal } from "@preact/signals";

export interface RealVideoTimeComponentProps {
	time: Signal<number | null>;
	formatTime: (timeInMs: number) => string;
}
