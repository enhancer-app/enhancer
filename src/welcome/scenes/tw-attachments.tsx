import "./tw-attachments.css";

import { locale, ui } from "./locale";
import { Cursor, Stage, useLoop, useTyping } from "./scene";

import type { SceneProps } from "./scene";

type Kind = "chat" | "react" | "mine";

interface Line {
	name: string;
	text: string;
}

const WIDTH = 340;
const HEIGHT = 480;
const LINK = "https://i.imgur.com/Xq7mB2k.png";
const LOOPS_KEPT = 3;
const COLORS = ["#9acd32", "#1e90ff", "#ff7f50", "#ff69b4", "#daa520", "#00d27a", "#b464ff"];

const CHAT = {
	en: {
		me: "Mizkiwi",
		typed: "desk setup done ",
		chat: [
			{ name: "Ludvig", text: "that clutch was insane" },
			{ name: "Tarek", text: "LETS GO" },
			{ name: "NineZ", text: "chat is ahead of me again lol" },
			{ name: "Klix", text: "clip it" },
			{ name: "Jynxzzz", text: "GG" },
			{ name: "CarlJacuzzi", text: "how is he this calm" },
			{ name: "Nunja", text: "first try?? no way" },
			{ name: "sodapopper", text: "one more round" },
		],
		react: [
			{ name: "Gaulez", text: "clean setup" },
			{ name: "CaseOkay", text: "so cozy" },
			{ name: "HasanAbby", text: "W setup" },
			{ name: "Lyrik", text: "love those colours" },
		],
	},
	pl: {
		me: "kloczek___",
		typed: "zobaczcie moje biurko ",
		chat: [
			{ name: "wiktorkropkapl", text: "hejkaaaa!!!!" },
			{ name: "mozewinka", text: "oo wkońcu zmiana gierki" },
			{ name: "7isai", text: "to gta v ? XD" },
			{ name: "GraczekTTV", text: "Siema Kamiś" },
			{ name: "STASxSKK", text: "zrobisz jakąś fabułę?" },
			{ name: "Niewyczochrana", text: "kupiłeś psa czy pożyczyłeś?" },
			{ name: "Gambit_Florydy", text: "ŁEEEEEEEEE" },
			{ name: "mozewinka", text: "wkoncu dobra gierka" },
		],
		react: [
			{ name: "Veniakk", text: "ale czysto" },
			{ name: "oszust95", text: "ładne kolory" },
			{ name: "Adamproxx", text: "XD" },
			{ name: "Pathyk", text: "też chcę takie" },
		],
	},
}[locale];

const TYPED = CHAT.typed;
const users = [...new Set([CHAT.me, ...[...CHAT.chat, ...CHAT.react].map((line) => line.name)])];
const colorOf = (name: string) => COLORS[users.indexOf(name) % COLORS.length] ?? COLORS[0];

// Chat lines that arrive in each loop; the sender's own message arrives at step 7.
const events: { step: number; kind: Kind }[] = [
	{ step: 0, kind: "chat" },
	{ step: 1, kind: "chat" },
	{ step: 3, kind: "chat" },
	{ step: 5, kind: "chat" },
	{ step: 7, kind: "mine" },
	{ step: 9, kind: "react" },
	{ step: 10, kind: "react" },
	{ step: 11, kind: "chat" },
];
const perLoop = (kind: Kind) => events.filter((event) => event.kind === kind).length;

/** Picks the line for an event; pools rotate across loops so the history keeps changing. */
function lineFor(loop: number, index: number): Line {
	const kind = events[index]?.kind ?? "chat";
	if (kind === "mine") return { name: CHAT.me, text: TYPED.trim() };
	const pool = kind === "react" ? CHAT.react : CHAT.chat;
	const ordinal = events.slice(0, index).filter((event) => event.kind === kind).length;
	const position = (((loop * perLoop(kind) + ordinal) % pool.length) + pool.length) % pool.length;
	return pool[position] ?? pool[0]!;
}

// idle, to input, focus, type, paste, preview 2s, to Chat 1s, send 0s, image loads, three replies
const durations = [1000, 700, 350, 700, 650, 1000, 1000, 350, 650, 1300, 1200, 1200];
const cursorMoves = [0, 700, 0, 0, 0, 0, 750, 0, 0, 900, 0, 0];
const STILL_STEP = 8;

/** Calm gradient block standing in for the linked image. */
function DeskImage() {
	return <span className="twa-art" />;
}

export function TwAttachmentsScene({ playing, fit }: SceneProps) {
	const { step, tick } = useLoop(durations, playing, STILL_STEP);
	const loop = Math.floor(tick / durations.length);

	const focused = step >= 2 && step <= 6;
	const typed = useTyping(TYPED, step === 3, step > 3 && step <= 6, Math.floor(600 / TYPED.length));
	const draft = step >= 4 && step <= 6 ? `${TYPED}${LINK}` : typed;
	const preview = step >= 5 && step <= 8;
	const secondsLeft = 7 - Math.min(step, 7);

	const lines = [];
	for (let current = loop - LOOPS_KEPT; current <= loop; current += 1) {
		for (const [index, event] of events.entries()) {
			if (current === loop && event.step > step) continue;
			lines.push({ key: `${current}-${index}`, event, current, index });
		}
	}

	const rest = { x: 312, y: 330 };
	const input = { x: 250, y: 412 };
	const chat = { x: 300, y: 452 };
	const cursor = [rest, input, input, input, input, input, chat, chat, chat, rest, rest, rest][step] ?? rest;

	return (
		<Stage
			width={WIDTH}
			height={HEIGHT}
			fit={fit}
			label="Live chat with Enhancer: a viewer pastes an image link, Enhancer shows an image preview above the input, and after sending the image appears inline in chat."
		>
			<div className="twa">
				<div className="twa-head"></div>

				<div className="twa-list">
					<div className="twa-lines">
						{lines.map(({ key, event, current, index }) => {
							const line = lineFor(current, index);
							const name = (
								<span className="twa-name" style={{ color: colorOf(line.name) }}>
									{line.name}
								</span>
							);
							if (event.kind !== "mine") {
								return (
									<div key={key} className="twa-line">
										{name}: {line.text}
									</div>
								);
							}
							const loading = current === loop && step === 7;
							return (
								<div key={key} className="twa-line">
									{name}: {line.text}
									{loading ? (
										<span className="twa-url"> {LINK}</span>
									) : (
										<span className="twa-link">
											<DeskImage />
										</span>
									)}
								</div>
							);
						})}
					</div>
					{preview && (
						<div key={loop} className="twa-popup">
							<div className="twa-popup-head">
								<strong>{ui.imagePreview}</strong>
								<span className="twa-popup-timer">({secondsLeft}s)</span>
								<span className="twa-popup-close">✕</span>
								<span className="twa-popup-progress" />
							</div>
							<div className="twa-popup-body">
								<div>{ui.imageNote}</div>
								<DeskImage />
							</div>
						</div>
					)}
				</div>

				<div className={`twa-input${focused ? " is-focused" : ""}`}>
					<span className={`twa-input-text${draft ? "" : " is-empty"}`}>
						{focused && !draft && <i className="twa-caret" />}
						{draft || ui.input}
						{focused && draft && <i className="twa-caret" />}
					</span>
				</div>

				<div className="twa-actions">
					<span className={`twa-chat${step === 7 ? " is-pressed" : ""}`}>{ui.chat}</span>
				</div>
			</div>
			<Cursor x={cursor.x} y={cursor.y} duration={cursorMoves[step] ?? 0} pressed={step === 2 || step === 7} />
		</Stage>
	);
}
