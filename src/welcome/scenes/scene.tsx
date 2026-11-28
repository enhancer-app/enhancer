import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import type { CSSProperties, ReactNode } from "react";

export interface SceneProps {
	playing: boolean;
	fit?: boolean;
}

const prefersReducedMotion = () =>
	typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Steps through a looping timeline while `playing`; `tick` keeps counting across loops.
 * With reduced motion it parks on `stillStep`.
 */
export function useLoop(durations: number[], playing: boolean, stillStep = 0) {
	const [tick, setTick] = useState(0);
	const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
	const step = tick % durations.length;

	useEffect(() => {
		if (!playing || reduced) return;
		const timer = window.setTimeout(
			() => setTick((current) => current + 1),
			durations[tick % durations.length] ?? 1000,
		);
		return () => window.clearTimeout(timer);
	}, [tick, playing, reduced, durations]);

	return reduced ? { step: stillStep, tick: stillStep } : { step, tick };
}

export function useMediaQuery(query: string) {
	return useSyncExternalStore(
		(onChange) => {
			const list = window.matchMedia(query);
			list.addEventListener("change", onChange);
			return () => list.removeEventListener("change", onChange);
		},
		() => window.matchMedia(query).matches,
	);
}

export function useTimeline(durations: number[], playing: boolean, stillStep = 0) {
	return useLoop(durations, playing, stillStep).step;
}

/** Eases a number towards `target`; jumps instantly when `instant` is set. */
export function useTween(target: number, duration = 900, instant = false) {
	const [value, setValue] = useState(target);
	const fromRef = useRef(target);
	const valueRef = useRef(target);

	useEffect(() => {
		const total = instant || prefersReducedMotion() ? 0 : duration;
		fromRef.current = valueRef.current;
		const start = performance.now();
		let frame = 0;
		const tick = (now: number) => {
			const t = total === 0 ? 1 : Math.min(1, (now - start) / total);
			const eased = 1 - Math.pow(1 - t, 3);
			const next = fromRef.current + (target - fromRef.current) * eased;
			valueRef.current = next;
			setValue(next);
			if (t < 1) frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [target, duration, instant]);

	return value;
}

/** Reveals `text` one character at a time while `active`; returns the whole text when `done`. */
export function useTyping(text: string, active: boolean, done: boolean, speed = 32) {
	const [count, setCount] = useState(0);

	useEffect(() => {
		if (!active) return;
		const timer = window.setInterval(() => {
			setCount((current) => Math.min(text.length, current + 1));
		}, speed);
		return () => {
			window.clearInterval(timer);
			setCount(0);
		};
	}, [active, text, speed]);

	if (done) return text;
	return active ? text.slice(0, count) : "";
}

interface StageProps {
	width: number;
	height: number;
	label: string;
	fit?: boolean;
	/** Keeps the canvas in the accessibility tree for scenes with real controls. */
	interactive?: boolean;
	children: ReactNode;
}

/**
 * Renders a scene at a fixed design size and scales it to its container: to the width by
 * default, or to fit both dimensions when `fit` is set and the parent has a height.
 */
export function Stage({ width, height, label, fit = false, interactive = false, children }: StageProps) {
	const outerRef = useRef<HTMLElement>(null);
	// Unmeasured until the first resize callback, which also covers the prerendered markup.
	const [box, setBox] = useState({ scale: 1, left: 0, top: 0, measured: false });

	useEffect(() => {
		const outer = outerRef.current;
		if (!outer) return;
		const observer = new ResizeObserver(([entry]) => {
			if (!entry) return;
			const { width: cw, height: ch } = entry.contentRect;
			const scale = fit ? Math.min(cw / width, ch / height) : cw / width;
			setBox({
				scale,
				left: fit ? (cw - width * scale) / 2 : 0,
				top: fit ? (ch - height * scale) / 2 : 0,
				measured: true,
			});
		});
		observer.observe(outer);
		return () => observer.disconnect();
	}, [width, height, fit]);

	const style: CSSProperties = fit ? { height: "100%" } : { aspectRatio: `${width} / ${height}` };
	return (
		<figure ref={outerRef} className="scene" style={style}>
			<div
				className="scene-canvas"
				aria-hidden={interactive ? undefined : "true"}
				style={
					{
						width,
						height,
						transform: `translate(${box.left}px, ${box.top}px) scale(${box.scale})`,
						visibility: box.measured ? undefined : "hidden",
						"--scene-scale": box.scale,
					} as CSSProperties
				}
			>
				{children}
			</div>
			<figcaption className="sr-only">{label}</figcaption>
		</figure>
	);
}

export { Cursor } from "./cursor";

export function Avatar({ name, hue, size = 32 }: { name: string; hue: number; size?: number }) {
	return (
		<span
			className="scene-avatar"
			style={{
				width: size,
				height: size,
				fontSize: size * 0.4,
				background: `linear-gradient(135deg, hsl(${hue} 80% 62%), hsl(${hue + 40} 70% 42%))`,
			}}
		>
			{name[0]?.toUpperCase()}
		</span>
	);
}

export function StarIcon() {
	return (
		<svg viewBox="0 0 16 16" aria-hidden="true">
			<path d="M8 1.5l1.9 4 4.4.5-3.3 3 .9 4.4L8 11.2 4.1 13.4 5 9 1.7 6l4.4-.5z" />
		</svg>
	);
}

export function EnhancerMark({ size = 18 }: { size?: number }) {
	return <img src="/assets/enhancer/logo-128.png" width={size} height={size} alt="" />;
}

export const formatNumber = (value: number) => Math.round(value).toLocaleString("en-US");
