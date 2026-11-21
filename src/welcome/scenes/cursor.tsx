import { useLayoutEffect, useRef } from "react";

interface CursorProps {
	x: number;
	y: number;
	duration: number;
	pressed?: boolean;
	hidden?: boolean;
}

interface Point {
	x: number;
	y: number;
}

const reducedMotion = () =>
	typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Minimum-jerk profile: how a hand accelerates and brakes when it points at something.
const minimumJerk = (t: number) => t * t * t * (10 + t * (6 * t - 15));

/** A pointer that travels in a slight arc, overshoots a touch and never sits perfectly still. */
export function Cursor({ x, y, duration, pressed = false, hidden = false }: CursorProps) {
	const ref = useRef<HTMLDivElement>(null);
	const position = useRef<Point>({ x, y });
	const turn = useRef(1);

	// Layout effect so the first frame is already in place, not at the canvas origin.
	useLayoutEffect(() => {
		const element = ref.current;
		if (!element) return;
		const from = { ...position.current };
		element.style.transform = `translate(${from.x}px, ${from.y}px)`;
		const target = { x, y };
		const dx = target.x - from.x;
		const dy = target.y - from.y;
		const distance = Math.hypot(dx, dy);
		const still = reducedMotion();
		turn.current = -turn.current;

		// Bend the path sideways and stop a little past the target before settling on it.
		const bend = Math.min(60, distance * 0.18) * turn.current;
		const control = {
			x: from.x + dx / 2 - (dy / (distance || 1)) * bend,
			y: from.y + dy / 2 + (dx / (distance || 1)) * bend,
		};
		const overshoot = Math.min(6, distance * 0.04);
		const past = {
			x: target.x + (dx / (distance || 1)) * overshoot,
			y: target.y + (dy / (distance || 1)) * overshoot,
		};
		const travel = still || distance < 1 ? 0 : Math.max(duration, 220);
		const start = performance.now();
		let frame = 0;

		const tick = (now: number) => {
			const elapsed = now - start;
			let point: Point;
			if (elapsed < travel * 0.86) {
				const p = minimumJerk(elapsed / (travel * 0.86));
				const q = 1 - p;
				point = {
					x: q * q * from.x + 2 * q * p * control.x + p * p * past.x,
					y: q * q * from.y + 2 * q * p * control.y + p * p * past.y,
				};
			} else if (elapsed < travel) {
				const p = minimumJerk((elapsed - travel * 0.86) / (travel * 0.14));
				point = { x: past.x + (target.x - past.x) * p, y: past.y + (target.y - past.y) * p };
			} else {
				// Idle hand: a slow drift of about a pixel.
				const idle = still ? 0 : (elapsed - travel) / 1000;
				point = {
					x: target.x + Math.sin(idle * 1.7) * 0.9,
					y: target.y + Math.cos(idle * 1.3) * 0.7,
				};
			}
			position.current = point;
			element.style.transform = `translate(${point.x}px, ${point.y}px)`;
			if (!still) frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [x, y, duration]);

	return (
		<div ref={ref} className={`scene-cursor${pressed ? " is-pressed" : ""}`} style={{ opacity: hidden ? 0 : 1 }}>
			<svg width="20" height="20" viewBox="0 0 24 24">
				<path
					d="M4 2l15 9.5-6.6 1.3L16 20l-3 1.4-3.6-7.2L4 18.5z"
					fill="#fff"
					stroke="#000"
					strokeWidth="1.4"
					strokeLinejoin="round"
				/>
			</svg>
		</div>
	);
}
