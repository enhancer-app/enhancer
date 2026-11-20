import { useEffect, useState } from "react";

import { FaceAvatar } from "./face-avatar";
import { locale, ui } from "./locale";
import { Cursor, Stage, useMediaQuery, useTimeline } from "./scene";

import type { SceneLocale } from "./locale";
import type { SceneProps } from "./scene";

import "./tw-chatters.css";

const WIDTH = 760;
const HEIGHT = 150;

interface StreamData {
	channel: string;
	title: string;
	// loading, counter in, to counter, hover delay, tooltip, click, request, refreshed, leave, idle
	durations: number[];
	/** Viewers fall linearly from `from` to `to` after loading, then climb back while loading. */
	viewers: { from: number; to: number };
	chatters: (viewers: number, refreshed: boolean) => number;
}

const streams: Record<SceneLocale, StreamData> = {
	en: {
		channel: "CaiKenat",
		title: "late night stream with chat · new setup tour",
		durations: [650, 1300, 800, 300, 2300, 180, 420, 1500, 800, 900],
		viewers: { from: 12847, to: 12847 },
		chatters: (_, refreshed) => (refreshed ? 11618 : 11532),
	},
	// Everyone slowly leaves; the longer loop keeps the drain calm.
	pl: {
		channel: "demonnz1",
		title: "czekanie aż gucik wyłączy lajwa :((( Pozdrawiam <3",
		durations: [650, 3000, 800, 300, 4000, 180, 420, 3000, 800, 3500],
		viewers: { from: 2140, to: 168 },
		chatters: (viewers, refreshed) => Math.round(viewers * (refreshed ? 0.8 : 0.93)),
	},
};
const stream = streams[locale];
const { durations } = stream;
const stepStarts = durations.map((_, index) => durations.slice(0, index).reduce((sum, ms) => sum + ms, 0));
const dropStart = stepStarts[1] ?? 0;
const dropLength = durations.reduce((sum, ms) => sum + ms, 0) - dropStart;
const CLIMB_MS = 600;

/** Milliseconds spent in the current step, updated every frame while the count moves. */
function useStepElapsed(step: number, active: boolean) {
	const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
	const [elapsed, setElapsed] = useState({ step, ms: 0 });
	useEffect(() => {
		if (!active || reduced) return;
		const start = performance.now();
		let frame = requestAnimationFrame(function tick(now) {
			setElapsed({ step, ms: now - start });
			frame = requestAnimationFrame(tick);
		});
		return () => cancelAnimationFrame(frame);
	}, [step, active, reduced]);
	return elapsed.step === step ? elapsed.ms : 0;
}

function viewersAt(step: number, ms: number) {
	const { from, to } = stream.viewers;
	if (step === 0) {
		const t = Math.min(1, ms / CLIMB_MS);
		return to + (from - to) * t * t * (3 - 2 * t);
	}
	const t = Math.min(1, ((stepStarts[step] ?? 0) - dropStart + ms) / dropLength);
	return from - (from - to) * t;
}

const cursorMoves = [0, 0, 800, 0, 0, 0, 0, 0, 800, 0];
const rest = { x: 470, y: 138 };
const counter = { x: 722, y: 98 };

// Same format as the extension: plain below 10 000, space-grouped above.
const formatChatters = (value: number) =>
	value < 10000 ? value.toString() : value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

export function TwChattersScene({ playing, fit }: SceneProps) {
	const step = useTimeline(durations, playing, 4);
	const elapsed = useStepElapsed(step, playing && stream.viewers.from !== stream.viewers.to);
	const viewers = Math.round(viewersAt(step, elapsed));
	const chatters = step === 0 ? ui.loading : formatChatters(stream.chatters(viewers, step >= 7));
	const hovered = step >= 3 && step <= 7;
	const cursor = step >= 2 && step <= 7 ? counter : rest;

	return (
		<Stage
			width={WIDTH}
			height={HEIGHT}
			fit={fit}
			label="Under a live stream, Enhancer adds the number of logged-in chatters next to the viewer count. Hovering it explains the number and clicking it refreshes the counter."
		>
			<div className="twc">
				<span className="sk twc-player" />
				<div className="twc-avatar">
					<FaceAvatar seed={stream.channel} className="twc-avatar-pic" />
					<span className="twc-live">LIVE</span>
				</div>

				<div className="twc-info">
					<div className="twc-name">{stream.channel}</div>
					<div className="twc-title">{stream.title}</div>
					<div className="twc-meta">
						<span className="twc-category">Just Chatting</span>
						<span className="sk sk-round" style={{ width: 54, height: 16 }} />
						<span className="sk sk-round" style={{ width: 40, height: 16 }} />
					</div>
				</div>

				<div className="twc-stats">
					<div className="twc-viewers">
						<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
							<circle cx="10" cy="7" r="3.6" />
							<path d="M3.5 17.5c.4-3.6 3-5.6 6.5-5.6s6.1 2 6.5 5.6" />
						</svg>
						<strong>{viewers.toLocaleString("en-US")}</strong>
						<span className={`twc-chatters${hovered ? " is-hover" : ""}`}>
							<span className="twc-count">({chatters})</span>
							{step === 4 && (
								<span className="twc-tip">
									<i />
									{ui.chattersTip}
								</span>
							)}
						</span>
					</div>
				</div>
			</div>
			<Cursor x={cursor.x} y={cursor.y} duration={cursorMoves[step] ?? 0} pressed={step === 5} hidden={false} />
		</Stage>
	);
}
