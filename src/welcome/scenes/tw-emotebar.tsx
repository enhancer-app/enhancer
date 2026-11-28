import "./tw-emotebar.css";

import { locale, ui } from "./locale";
import { Cursor, Stage, useLoop } from "./scene";

import type { ReactNode } from "react";
import type { SceneLocale } from "./locale";
import type { SceneProps } from "./scene";

const WIDTH = 340;
const HEIGHT = 330;

// Original emote art; 28x28 grid, LETSGO is 2:1 like a wide third-party emote.
const face = (fill: string, children: ReactNode) => (
	<>
		<circle cx="14" cy="14" r="12.5" fill={fill} />
		<path d="M5 9.5a10.5 10.5 0 0 1 18 0" fill="none" stroke="#fff" strokeOpacity="0.25" strokeWidth="1.6" />
		{children}
	</>
);

const EMOTES = {
	glimLOL: face(
		"#ffc83d",
		<>
			<path
				d="M7.5 11.5l2.5-1.8 2.5 1.8M15.5 11.5l2.5-1.8 2.5 1.8"
				fill="none"
				stroke="#5a3a12"
				strokeWidth="1.6"
				strokeLinecap="round"
			/>
			<path d="M8 15.5h12a6 6 0 0 1-12 0z" fill="#5a3a12" />
			<path d="M10.5 19.5a3.6 2 0 0 1 7 0" fill="#ff7a7a" />
			<path d="M4.5 13.5c-1.6 2-1.8 3.6-.6 4.4 1.2.7 2.4-.4 2.2-2.4z" fill="#5cc8ff" />
		</>,
	),
	Gleep: (
		<>
			<path d="M14 3.5c6.5 0 11 4.5 11 11.2 0 6.5-4.6 9.8-11 9.8S3 21.2 3 14.7C3 8 7.5 3.5 14 3.5z" fill="#45c486" />
			<ellipse cx="9.6" cy="12.4" rx="3.3" ry="3.7" fill="#fff" />
			<ellipse cx="18.4" cy="12.4" rx="3.3" ry="3.7" fill="#fff" />
			<circle cx="10.3" cy="13" r="1.7" fill="#1b2a22" />
			<circle cx="19.1" cy="13" r="1.7" fill="#1b2a22" />
			<path d="M10.5 19c2.2 1.5 4.8 1.5 7 0" fill="none" stroke="#1b2a22" strokeWidth="1.6" strokeLinecap="round" />
		</>
	),
	catWave: (
		<>
			<path d="M4 4.5l6 4.5h8l6-4.5-.8 9.5C23.5 20.5 19.5 24.5 14 24.5S4.5 20.5 4.8 14z" fill="#f29a4a" />
			<path d="M6 7.5l3 2.4M22 7.5l-3 2.4" stroke="#ffd1a8" strokeWidth="1.8" strokeLinecap="round" />
			<path
				d="M9 14.2c.8-1 2-1 2.8 0M16.2 14.2c.8-1 2-1 2.8 0"
				fill="none"
				stroke="#3b2414"
				strokeWidth="1.6"
				strokeLinecap="round"
			/>
			<path d="M12.8 17.4h2.4L14 18.7z" fill="#e0607a" />
			<path d="M11.5 20c1.5 1 3.5 1 5 0" fill="none" stroke="#3b2414" strokeWidth="1.3" strokeLinecap="round" />
		</>
	),
	glimWow: face(
		"#ffc83d",
		<>
			<circle cx="9.8" cy="11.5" r="3" fill="#fff" />
			<circle cx="18.2" cy="11.5" r="3" fill="#fff" />
			<circle cx="9.8" cy="11.8" r="1.5" fill="#3a2a10" />
			<circle cx="18.2" cy="11.8" r="1.5" fill="#3a2a10" />
			<ellipse cx="14" cy="19" rx="2.6" ry="3.2" fill="#5a3a12" />
		</>,
	),
	LETSGO: (
		<>
			<rect x="1" y="4" width="54" height="20" rx="5" fill="#2fbf71" />
			<path d="M4 7h48" stroke="#fff" strokeOpacity="0.3" strokeWidth="1.5" strokeLinecap="round" />
			<text
				x="28"
				y="18.6"
				textAnchor="middle"
				textLength="44"
				lengthAdjust="spacingAndGlyphs"
				fill="#fff"
				fontSize="11"
				fontWeight="900"
				fontFamily="Inter, Arial, sans-serif"
				fontStyle="italic"
			>
				LETS GO
			</text>
		</>
	),
	glimHappy: face(
		"#ffc83d",
		<>
			<circle cx="10" cy="11.5" r="1.7" fill="#5a3a12" />
			<circle cx="18" cy="11.5" r="1.7" fill="#5a3a12" />
			<path d="M8.8 16.2c2.8 3.6 7.6 3.6 10.4 0" fill="none" stroke="#5a3a12" strokeWidth="1.8" strokeLinecap="round" />
			<circle cx="7" cy="16" r="1.6" fill="#ff8f6b" opacity="0.7" />
			<circle cx="21" cy="16" r="1.6" fill="#ff8f6b" opacity="0.7" />
		</>,
	),
	glimLove: (
		<>
			<path
				d="M14 24.5S3 17.8 3 10.3C3 6.8 5.6 4.5 8.6 4.5c2.4 0 4.3 1.4 5.4 3.3 1.1-1.9 3-3.3 5.4-3.3 3 0 5.6 2.3 5.6 5.8 0 7.5-11 14.2-11 14.2z"
				fill="#ff4f73"
			/>
			<path
				d="M6.5 9.5c.4-1.6 1.6-2.4 3-2.4"
				fill="none"
				stroke="#fff"
				strokeOpacity="0.5"
				strokeWidth="1.5"
				strokeLinecap="round"
			/>
			<circle cx="10.5" cy="12.5" r="1.4" fill="#5c1020" />
			<circle cx="17.5" cy="12.5" r="1.4" fill="#5c1020" />
			<path d="M11.8 15.6c1.3 1 3.1 1 4.4 0" fill="none" stroke="#5c1020" strokeWidth="1.4" strokeLinecap="round" />
		</>
	),
	GGwp: (
		<>
			<rect x="2" y="3" width="24" height="22" rx="5" fill="#7d5cff" />
			<rect x="2" y="3" width="24" height="10" rx="5" fill="#fff" fillOpacity="0.12" />
			<text
				x="14"
				y="18.6"
				textAnchor="middle"
				fill="#fff"
				fontSize="11.5"
				fontWeight="900"
				fontFamily="Inter, Arial, sans-serif"
			>
				GG
			</text>
		</>
	),
	glimFire: (
		<>
			<path
				d="M14 2.5c1 4.5 6.5 6.8 6.5 12.6A6.5 6.5 0 0 1 14 25.5a6.5 6.5 0 0 1-6.5-6.4c0-3 1.4-4.6 2.6-6 .2 2 1 3 2 3.4-.5-4.6 1-9.2 1.9-14z"
				fill="#ff7a1a"
			/>
			<path
				d="M14 13c.5 2.4 3.4 3.5 3.4 6.4a3.4 3.4 0 0 1-6.8 0c0-1.6.8-2.5 1.4-3.2.1 1 .5 1.6 1 1.8-.2-2 .4-3.6 1-5z"
				fill="#ffd23d"
			/>
		</>
	),
	glimSad: face(
		"#ffc83d",
		<>
			<circle cx="10" cy="12" r="1.7" fill="#5a3a12" />
			<circle cx="18" cy="12" r="1.7" fill="#5a3a12" />
			<path d="M9.5 20c2.6-2.6 6.4-2.6 9 0" fill="none" stroke="#5a3a12" strokeWidth="1.8" strokeLinecap="round" />
			<path d="M19.5 14.5c-1.3 1.8-1.5 3.2-.4 3.8 1 .5 2-.3 1.8-2z" fill="#5cc8ff" />
		</>,
	),
	glimDead: (
		<>
			<path
				d="M14 3c6.1 0 10 4 10 9.2 0 3.3-1.4 5.3-3 6.5V23a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 7 23v-4.3c-1.6-1.2-3-3.2-3-6.5C4 7 7.9 3 14 3z"
				fill="#e8e6f0"
			/>
			<circle cx="10" cy="12.6" r="2.6" fill="#2a2633" />
			<circle cx="18" cy="12.6" r="2.6" fill="#2a2633" />
			<path d="M13 17.5l1-1.8 1 1.8zM11 21v3.4M14 21v3.4M17 21v3.4" fill="#2a2633" stroke="#2a2633" strokeWidth="1.2" />
		</>
	),
	glimHmm: face(
		"#ffc83d",
		<>
			<path d="M7.6 9.2l3.6-1M16.8 8.6l3.6.8" stroke="#5a3a12" strokeWidth="1.5" strokeLinecap="round" />
			<circle cx="10" cy="12.2" r="1.6" fill="#5a3a12" />
			<circle cx="18" cy="12.2" r="1.6" fill="#5a3a12" />
			<path d="M10.5 18.6l7-1.2" stroke="#5a3a12" strokeWidth="1.8" strokeLinecap="round" />
		</>,
	),
} satisfies Record<string, ReactNode>;

type EmoteName = keyof typeof EMOTES;

const isEmote = (word: string): word is EmoteName => Object.hasOwn(EMOTES, word);
const ratioOf = (name: EmoteName) => (name === "LETSGO" ? 2 : 1);

function Emote({ name, height }: { name: EmoteName; height: number }) {
	const width = height * ratioOf(name);
	return (
		<svg className="twe-emote" width={width} height={height} viewBox={`0 0 ${28 * ratioOf(name)} 28`} aria-label={name}>
			{EMOTES[name]}
		</svg>
	);
}

interface Chatter {
	name: string;
	color: string;
}

const COLORS = ["#ff69b4", "#1e90ff", "#00d27a", "#daa520", "#ff7f50", "#9acd32", "#b464ff"];

// Fictional chatters; `me` sends the emotes.
const CHAT: Record<SceneLocale, { me: string; lines: [string, string][] }> = {
	en: {
		me: "Mizkiwi",
		lines: [
			["Ludvig", "glimLOL glimLOL"],
			["Tarek", "that was clean"],
			["NineZ", "Gleep"],
			["Klix", "LETSGO LETSGO"],
			["Jynxzzz", "how is he so calm glimWow"],
			["CarlJacuzzi", "GGwp"],
			["Nunja", "catWave catWave"],
			["sodapopper", "one more round"],
			["Gaulez", "glimFire glimFire glimFire"],
			["CaseOkay", "chat is ahead of me glimLOL"],
			["HasanAbby", "glimLove"],
			["Lyrik", "wait what glimHmm"],
			["xQz", "clip it"],
			["shrug", "GG glimHappy"],
		],
	},
	pl: {
		me: "StasiekLive",
		lines: [
			["wiktorkropkapl", "hejkaaaa!!!! glimLove"],
			["mozewinka", "glimLOL glimLOL"],
			["7isai", "to gta v ? XD"],
			["GraczekTTV", "Siema Kamiś catWave"],
			["kloczek___", "LETSGO LETSGO"],
			["STASxSKK", "ŁEEEEEEEEE"],
			["Veniakk", "szerzej glimWow"],
			["Gambit_Florydy", "GGwp"],
			["oszust95", "!kaska"],
			["Niewyczochrana", "kupiłeś psa czy pożyczyłeś?"],
			["Adamproxx", "lepsze niż gta 6 glimFire"],
			["demonnz1", "glimHmm"],
			["Pathyk", "XD glimLOL"],
			["mozewinka", "wkoncu dobra gierka"],
		],
	},
};

const { me, lines: chatLines } = CHAT[locale];
const users = [...new Set([me, ...chatLines.map(([name]) => name)])];
const chatterOf = (name: string): Chatter => ({
	name,
	color: COLORS[users.indexOf(name) % COLORS.length] ?? "#b19cff",
});
const ME = chatterOf(me);
const OTHERS: [Chatter, string][] = chatLines.map(([name, text]) => [chatterOf(name), text]);

// Frecency order of the stored entries (score, then last use); only the first ones fit the bar.
const BASE: EmoteName[] = [
	"glimLOL",
	"Gleep",
	"catWave",
	"glimWow",
	"LETSGO",
	"glimHappy",
	"glimLove",
	"GGwp",
	"glimFire",
	"glimSad",
	"glimDead",
	"glimHmm",
];
// Each send adds 1 to the emote's score, lifting it past emotes with a lower score.
const SENDS: { emote: EmoteName; after: EmoteName[] }[] = [
	{ emote: "glimWow", after: ["glimLOL", "glimWow", "Gleep", "catWave", ...BASE.slice(4)] },
	{ emote: "Gleep", after: ["glimLOL", "Gleep", "glimWow", "catWave", ...BASE.slice(4)] },
	{ emote: "catWave", after: BASE },
];

const EMOTE_HEIGHT = 24;
const BUTTON_PADDING = 2;
const GAP = 2;
const BAR_LEFT = 10;
const BAR_WIDTH = WIDTH - 2 * BAR_LEFT;
const BAR_Y = 225;
const buttonWidth = (name: EmoteName) => EMOTE_HEIGHT * ratioOf(name) + BUTTON_PADDING * 2;

/** Mirrors selectVisible: greedy fit by rank, then space-between when entries are left out. */
function layoutBar(order: EmoteName[]) {
	let used = 0;
	const visible = order.filter((name) => {
		if (used + buttonWidth(name) + GAP > BAR_WIDTH + GAP) return false;
		used += buttonWidth(name) + GAP;
		return true;
	});
	const total = visible.reduce((sum, name) => sum + buttonWidth(name), 0);
	const spacing = (BAR_WIDTH - total) / (visible.length - 1);
	const centers = new Map<EmoteName, number>();
	let x = BAR_LEFT;
	for (const name of visible) {
		centers.set(name, x + buttonWidth(name) / 2);
		x += buttonWidth(name) + spacing;
	}
	return { visible, centers };
}

type Phase = "idle" | "toEmote" | "pressEmote" | "toChat" | "pressChat" | "settle";

interface Step {
	phase: Phase;
	send: number;
	duration: number;
	messages: ("other" | "self")[];
}

const STEPS: Step[] = [
	{ phase: "idle", send: 0, duration: 900, messages: ["other"] },
	...SENDS.flatMap((_, send): Step[] => [
		{ phase: "toEmote", send, duration: 700, messages: ["other"] },
		{ phase: "pressEmote", send, duration: 220, messages: [] },
		{ phase: "toChat", send, duration: 650, messages: ["other"] },
		{ phase: "pressChat", send, duration: 220, messages: ["self"] },
		{ phase: "settle", send, duration: 700, messages: ["other"] },
		{ phase: "settle", send, duration: 600, messages: ["other"] },
	]),
];
const durations = STEPS.map((step) => step.duration);
const template = STEPS.flatMap((step) => step.messages.map((kind) => ({ kind, send: step.send })));
const perLoop = template.length;
const othersPerLoop = template.filter((entry) => entry.kind === "other").length;
const sentBefore = STEPS.map((_, index) =>
	STEPS.slice(0, index + 1).reduce((sum, step) => sum + step.messages.length, 0),
);
const VISIBLE_LINES = 6;
const mod = (value: number, size: number) => ((value % size) + size) % size;

function messageAt(index: number): [Chatter, string] {
	const loop = Math.floor(index / perLoop);
	const position = mod(index, perLoop);
	const entry = template[position];
	if (entry?.kind === "self") return [ME, SENDS[entry.send]?.emote ?? "glimLOL"];
	const ordinal = template.slice(0, position).filter((item) => item.kind === "other").length;
	return OTHERS[mod(loop * othersPerLoop + ordinal, OTHERS.length)] ?? OTHERS[0]!;
}

function ChatLine({ chatter, text }: { chatter: Chatter; text: string }) {
	return (
		<div className={`twe-line${chatter === ME ? " is-me" : ""}`}>
			<span className="twe-name" style={{ color: chatter.color }}>
				{chatter.name}
			</span>
			<span>: </span>
			{text.split(" ").map((word, index) => (
				<span key={index}>
					{index > 0 && " "}
					{isEmote(word) ? <Emote name={word} height={24} /> : word}
				</span>
			))}
		</div>
	);
}

export function TwEmoteBarScene({ playing, fit }: SceneProps) {
	const { step, tick } = useLoop(durations, playing, 5);
	const current = STEPS[step] ?? STEPS[0]!;
	const loop = Math.floor(tick / durations.length);
	const total = loop * perLoop + (sentBefore[step] ?? 0);
	const lines = Array.from({ length: VISIBLE_LINES }, (_, offset) => total - VISIBLE_LINES + offset);

	// The bar keeps the previous order until the sent message is recorded.
	const lastDone =
		current.phase === "idle" ? SENDS.length - 1 : current.phase === "settle" ? current.send : current.send - 1;
	const order = lastDone < 0 ? BASE : (SENDS[lastDone]?.after ?? BASE);
	const bar = layoutBar(order);

	const target = SENDS[current.send]?.emote ?? "glimLOL";
	const typed = current.phase === "pressEmote" || current.phase === "toChat" ? `${target} ` : "";
	const emoteSpot = { x: bar.centers.get(target) ?? 0, y: BAR_Y };
	const chatSpot = { x: 304, y: 305 };
	const rest = { x: 196, y: 300 };
	const cursor = {
		idle: rest,
		toEmote: emoteSpot,
		pressEmote: emoteSpot,
		toChat: chatSpot,
		pressChat: chatSpot,
		settle: chatSpot,
	}[current.phase];
	const moving = current.phase === "idle" || current.phase === "toEmote" || current.phase === "toChat";
	const pressed = current.phase === "pressEmote" || current.phase === "pressChat";
	const hoverEmote = current.phase === "pressEmote" ? target : null;
	const chatHover = current.phase === "pressChat" || current.phase === "settle";

	return (
		<Stage
			width={WIDTH}
			height={HEIGHT}
			fit={fit}
			label="Live chat with the Enhancer emote bar above the chat input. Clicking an emote in the bar puts it in the input, the message is sent, and the bar reorders by how often and how recently each emote was used."
		>
			<div className="twe">
				<div className="twe-log">
					{lines.map((index) => {
						const [chatter, text] = messageAt(index);
						return <ChatLine key={index} chatter={chatter} text={text} />;
					})}
				</div>
				<div className="twe-input-area">
					<div className="twe-bar">
						{bar.visible.map((name) => (
							<span key={name} className={`twe-bar-button${hoverEmote === name ? " is-active" : ""}`}>
								<Emote name={name} height={EMOTE_HEIGHT} />
							</span>
						))}
					</div>
					<div className="twe-input">
						<span className={typed ? "twe-input-text" : "twe-input-placeholder"}>{typed || ui.input}</span>
					</div>
					<div className="twe-buttons">
						<span className={`twe-chat${chatHover ? " is-hover" : ""}`}>{ui.chat}</span>
					</div>
				</div>
			</div>
			<Cursor
				x={cursor.x - 3}
				y={cursor.y - 2}
				duration={moving ? current.duration : 0}
				pressed={pressed}
				hidden={false}
			/>
		</Stage>
	);
}
