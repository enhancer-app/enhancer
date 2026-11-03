import type { RefObject } from "preact";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";

const MOVE_DURATION_MS = 440;
const ENTER_DURATION_MS = 520;
const EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";

export const FLIP_KEY_ATTRIBUTE = "data-flip-key";

export function useFlipAnimation(containerRef: RefObject<HTMLElement>, keys: string[]): void {
	const positionsRef = useRef(new Map<string, { x: number; y: number }>());
	const initializedRef = useRef(false);
	const signature = keys.join("|");

	useLayoutEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const origin = container.getBoundingClientRect();
		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const next = new Map<string, { x: number; y: number }>();

		for (const element of container.querySelectorAll<HTMLElement>(`[${FLIP_KEY_ATTRIBUTE}]`)) {
			const key = element.getAttribute(FLIP_KEY_ATTRIBUTE);
			if (!key) continue;
			const rect = element.getBoundingClientRect();
			const position = { x: rect.left - origin.left, y: rect.top - origin.top };
			next.set(key, position);
			if (!initializedRef.current || reduceMotion) continue;

			const previous = positionsRef.current.get(key);
			if (!previous) {
				element.animate(
					[
						{ opacity: 0, transform: "translateY(10px) scale(0.94)" },
						{ opacity: 1, transform: "none" },
					],
					{ duration: ENTER_DURATION_MS, easing: EASING },
				);
				continue;
			}
			const dx = previous.x - position.x;
			const dy = previous.y - position.y;
			if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
			element.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
				duration: MOVE_DURATION_MS,
				easing: EASING,
			});
		}

		positionsRef.current = next;
		initializedRef.current = next.size > 0;
	}, [signature]);
}

export function useBecameTrue(value: boolean): number {
	const previousRef = useRef(value);
	const [count, setCount] = useState(0);

	useEffect(() => {
		if (previousRef.current === value) return;
		previousRef.current = value;
		if (value) setCount((current) => current + 1);
	}, [value]);

	return count;
}
