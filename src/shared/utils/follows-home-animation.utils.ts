import type { RefObject } from "preact";
import { useCallback, useLayoutEffect, useRef } from "preact/hooks";

export const HOME_ANIMATION_KEY = "data-home-key";
export const HOME_LIVE_BADGE = "data-home-live-badge";

const EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const MOVE_DURATION_MS = 380;
const ENTER_DURATION_MS = 320;
const ENTER_STAGGER_MS = 35;
const ENTER_MAX_STAGGERED = 16;
const POP_DURATION_MS = 420;
const EXIT_DURATION_MS = 180;
const SWITCH_OUT_MS = 90;
const SWITCH_IN_MS = 150;

type Box = { x: number; y: number; width: number; height: number; element: HTMLElement };

export function useFollowsHomeAnimation(containerRef: RefObject<HTMLElement>, keys: string[]) {
	const boxesRef = useRef(new Map<string, Box>());
	const initializedRef = useRef(false);
	const switchingRef = useRef(false);
	const signature = keys.join("|");

	useLayoutEffect(() => {
		const container = containerRef.current;
		if (!container) return;
		const origin = container.getBoundingClientRect();
		const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		const previous = boxesRef.current;
		const next = new Map<string, Box>();
		const elements = [...container.querySelectorAll<HTMLElement>(`[${HOME_ANIMATION_KEY}]`)];

		for (const element of elements) {
			const key = element.getAttribute(HOME_ANIMATION_KEY);
			if (!key) continue;
			const rect = element.getBoundingClientRect();
			next.set(key, {
				x: rect.left - origin.left,
				y: rect.top - origin.top,
				width: rect.width,
				height: rect.height,
				element,
			});
		}
		boxesRef.current = next;
		if (reduceMotion || next.size === 0) return;

		if (!initializedRef.current) {
			initializedRef.current = true;
			elements.forEach((element, index) => {
				element.animate(
					[
						{ opacity: 0, transform: "translateY(8px)" },
						{ opacity: 1, transform: "none" },
					],
					{
						duration: ENTER_DURATION_MS,
						delay: Math.min(index, ENTER_MAX_STAGGERED) * ENTER_STAGGER_MS,
						easing: EASING,
						fill: "backwards",
					},
				);
			});
			return;
		}

		if (switchingRef.current) {
			switchingRef.current = false;
			container.animate([{ opacity: 0 }, { opacity: 1 }], { duration: SWITCH_IN_MS, easing: "ease-out" });
			return;
		}

		for (const [key, box] of previous) {
			if (!next.has(key) && !box.element.isConnected) fadeOutGhost(container, box);
		}
		for (const [key, box] of next) {
			const before = previous.get(key);
			if (!before) {
				enter(key, box.element);
				continue;
			}
			const dx = before.x - box.x;
			const dy = before.y - box.y;
			if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
			box.element.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], {
				duration: MOVE_DURATION_MS,
				easing: EASING,
			});
		}
	}, [signature]);

	return useCallback(
		async (apply: () => void) => {
			const container = containerRef.current;
			const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
			if (container && !reduceMotion && initializedRef.current) {
				switchingRef.current = true;
				await container
					.animate([{ opacity: 1 }, { opacity: 0 }], { duration: SWITCH_OUT_MS, fill: "forwards" })
					.finished.catch(() => {});
				container.getAnimations().forEach((animation) => animation.cancel());
			}
			apply();
		},
		[containerRef],
	);
}

function enter(key: string, element: HTMLElement) {
	if (!key.startsWith("live:")) {
		element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ENTER_DURATION_MS, easing: "ease-out" });
		return;
	}
	element.animate(
		[
			{ opacity: 0, transform: "scale(0.92)" },
			{ opacity: 1, transform: "scale(1.02)", offset: 0.7 },
			{ opacity: 1, transform: "none" },
		],
		{ duration: POP_DURATION_MS, easing: EASING },
	);
	element
		.querySelector(`[${HOME_LIVE_BADGE}]`)
		?.animate([{ transform: "scale(1)" }, { transform: "scale(1.25)" }, { transform: "scale(1)" }], {
			duration: 500,
			delay: 300,
		});
}

function fadeOutGhost(container: HTMLElement, box: Box) {
	const ghost = box.element;
	Object.assign(ghost.style, {
		position: "absolute",
		left: `${box.x}px`,
		top: `${box.y}px`,
		width: `${box.width}px`,
		height: `${box.height}px`,
		margin: "0",
		pointerEvents: "none",
		zIndex: "1",
	});
	container.append(ghost);
	ghost
		.animate([{ opacity: 1 }, { opacity: 0 }], { duration: EXIT_DURATION_MS, easing: "ease-in", fill: "forwards" })
		.finished.catch(() => {})
		.finally(() => ghost.remove());
}
