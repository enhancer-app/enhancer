import "./tw-account.css";

import { supporterBadge } from "../welcome.content";

import { locale, ui } from "./locale";
import { Stage, useLoop, useMediaQuery } from "./scene";

import type { ReactNode } from "react";

import type { SceneLocale } from "./locale";
import type { SceneProps } from "./scene";

type Badge = "host" | "heart" | "star" | "supporter";
type Emote = "plead" | "heart";
type Style = "renamed" | "glow";

interface Message {
	user: string;
	text: string;
	/** Shown instead of `user`; the colour stays the original one. */
	nick?: string;
	badge?: Badge;
	emote?: Emote;
	style?: Style;
}

/** A scripted message, or `null` for a filler line from the rotating pool. */
type Beat = { message: Message | null; ms: number };

const COLORS = ["#9acd32", "#1e90ff", "#ff7f50", "#ff69b4", "#daa520", "#00d27a", "#b464ff"];
const LOOPS_KEPT = 2;

const STORY: Record<
	SceneLocale,
	{ host: string; a: string; b: string; c: string; beats: Beat[]; fillers: [string, string][] }
> = {
	en: {
		host: "CaiKenat",
		a: "Ludvig",
		b: "Tarek",
		c: "Klix",
		beats: [
			{ message: null, ms: 1000 },
			{ message: { user: "Ludvig", text: "hey, can I get a badge?", emote: "plead" }, ms: 1400 },
			{ message: null, ms: 900 },
			{ message: { user: "CaiKenat", text: "sure, here you go", badge: "host" }, ms: 1300 },
			{ message: { user: "Ludvig", text: "thank youu!", badge: "heart" }, ms: 1700 },
			{ message: null, ms: 900 },
			{ message: { user: "Tarek", text: "can I get one too, and a new nickname?" }, ms: 1500 },
			{ message: { user: "CaiKenat", text: "done", badge: "host" }, ms: 1200 },
			{
				message: {
					user: "Tarek",
					nick: "TarekTheGreat",
					text: "this is sick",
					badge: "star",
					style: "renamed",
				},
				ms: 1900,
			},
			{ message: null, ms: 900 },
			{ message: { user: "Klix", text: "just got an Enhancer sub :DD" }, ms: 1300 },
			{ message: null, ms: 1000 },
			{
				message: { user: "Klix", text: "look at my name now", badge: "supporter", style: "glow" },
				ms: 2100,
			},
			{ message: null, ms: 1100 },
			{ message: null, ms: 1100 },
		],
		fillers: [
			["NineZ", "chat is ahead of me again lol"],
			["Mizkiwi", "hi chat"],
			["Jynxzzz", "GG"],
			["CarlJacuzzi", "how is he this calm"],
			["Nunja", "first try?? no way"],
			["sodapopper", "one more round"],
			["Gaulez", "W"],
			["Lyrik", "that timing was insane"],
		],
	},
	pl: {
		host: "demonnz1",
		a: "mozewinka",
		b: "igorovh",
		c: "wiktorkropkapl",
		beats: [
			{ message: null, ms: 1000 },
			{ message: { user: "mozewinka", text: "hej, mogę odznakę?", emote: "plead" }, ms: 1400 },
			{ message: null, ms: 900 },
			{ message: { user: "demonnz1", text: "jasne, łap", badge: "host" }, ms: 1300 },
			{ message: { user: "mozewinka", text: "dziękiii!!", badge: "heart" }, ms: 1700 },
			{ message: null, ms: 900 },
			{ message: { user: "igorovh", text: "ej a ja mogę odznakę i inny nick?" }, ms: 1500 },
			{ message: { user: "demonnz1", text: "jasne", badge: "host" }, ms: 1200 },
			{
				message: {
					user: "igorovh",
					nick: "igor",
					text: "ale fajnie XD",
					badge: "star",
					style: "renamed",
				},
				ms: 1900,
			},
			{ message: null, ms: 900 },
			{ message: { user: "wiktorkropkapl", text: "kupiłem suba w Enhancerze :DD" }, ms: 1300 },
			{ message: null, ms: 1000 },
			{
				message: {
					user: "wiktorkropkapl",
					text: "patrzcie jaki mam nick",
					badge: "supporter",
					style: "glow",
				},
				ms: 2100,
			},
			{ message: null, ms: 1100 },
			{ message: null, ms: 1100 },
		],
		fillers: [
			["GraczekTTV", "Siema Kamiś"],
			["kloczek___", "zrobisz jakąś fabułę?"],
			["Veniakk", "szerzej"],
			["STASxSKK", "wkoncu dobra gierka"],
			["oszust95", "ładne kolory"],
			["Pathyk", "ale czysto to zrobił"],
			["Adamproxx", "XD"],
			["Gambit_Florydy", "ŁEEEEEEEEE"],
		],
	},
};
const story = STORY[locale];
const durations = story.beats.map((beat) => beat.ms);
const fillerSlots = story.beats.flatMap((beat, index) => (beat.message ? [] : [index]));
// The supporter's message: badge, nickname and glow are all on screen from here on.
const STILL_STEP = story.beats.findIndex((beat) => beat.message?.style === "glow");

const users = [...new Set([story.host, story.a, story.b, story.c, ...story.fillers.map(([name]) => name)])];
const colorOf = (name: string) => COLORS[users.indexOf(name) % COLORS.length] ?? COLORS[0];

function messageAt(loop: number, index: number): Message {
	const scripted = story.beats[index]?.message;
	if (scripted) return scripted;
	const ordinal = fillerSlots.indexOf(index);
	const count = story.fillers.length;
	const position = (((loop * fillerSlots.length + ordinal) % count) + count) % count;
	const [user, text] = story.fillers[position] ?? story.fillers[0]!;
	return { user, text };
}

// Original badge art on a 16x16 grid.
const BADGES: Record<Badge, { color: string; glyph: ReactNode }> = {
	host: {
		color: "#e91916",
		glyph: (
			<path d="M1.5 5.5A1.5 1.5 0 0 1 3 4h6.5A1.5 1.5 0 0 1 11 5.5v5A1.5 1.5 0 0 1 9.5 12H3a1.5 1.5 0 0 1-1.5-1.5zM11.8 7.2 14.8 5v6l-3-2.2z" />
		),
	},
	heart: {
		color: "#ec4f86",
		glyph: <path d="M8 14S2 10.3 2 5.9A3.3 3.3 0 0 1 8 4a3.3 3.3 0 0 1 6 1.9C14 10.3 8 14 8 14z" />,
	},
	star: {
		color: "#f5a524",
		glyph: <path d="M8 1l2.1 4.5 4.9.6-3.6 3.3 1 4.8L8 11.8l-4.4 2.4 1-4.8L1 6.1l4.9-.6z" />,
	},
	supporter: {
		color: "#9147ff",
		glyph: (
			<>
				<path d="M4.2 2h7.6L15 6.2 8 14.5 1 6.2z" />
				<path
					d="M1 6.2h14M5.6 6.2 8 14.5l2.4-8.3M4.2 2l1.4 4.2L8 2l2.4 4.2L11.8 2"
					fill="none"
					stroke="rgba(0,0,0,0.28)"
					strokeWidth="0.9"
					strokeLinejoin="round"
				/>
			</>
		),
	},
};

function BadgeIcon({ badge }: { badge: Badge }) {
	if (badge === "supporter") {
		return (
			<img className="twx-badge twx-badge-img is-new" src={supporterBadge} alt="" loading="lazy" decoding="async" />
		);
	}
	const { color, glyph } = BADGES[badge];
	return (
		<span className={`twx-badge${badge === "host" ? "" : " is-new"}`} style={{ background: color }}>
			<svg viewBox="0 0 16 16" aria-hidden="true">
				{glyph}
			</svg>
		</span>
	);
}

// Drawn emotes on a 28x28 grid, so they look the same on every system.
function EmoteIcon({ emote }: { emote: Emote }) {
	return (
		<svg className="twx-emote" viewBox="0 0 28 28" aria-hidden="true">
			{emote === "plead" ? (
				<>
					<circle cx="14" cy="14" r="12.5" fill="#ffc83d" />
					<path d="M6.5 9.5l4-1.5M21.5 9.5l-4-1.5" stroke="#5a3a12" strokeWidth="1.5" strokeLinecap="round" />
					<circle cx="9.5" cy="13.5" r="3.4" fill="#5a3a12" />
					<circle cx="18.5" cy="13.5" r="3.4" fill="#5a3a12" />
					<circle cx="10.6" cy="12.4" r="1.2" fill="#fff" />
					<circle cx="19.6" cy="12.4" r="1.2" fill="#fff" />
					<path d="M11 21.5a3.5 2.2 0 0 1 6 0" fill="none" stroke="#5a3a12" strokeWidth="1.6" strokeLinecap="round" />
				</>
			) : (
				<path
					d="M14 24.5S3.5 18 3.5 10.6A5.3 5.3 0 0 1 14 8.4a5.3 5.3 0 0 1 10.5 2.2C24.5 18 14 24.5 14 24.5z"
					fill="#a970ff"
				/>
			)}
		</svg>
	);
}

export function TwAccountScene({ playing, fit }: SceneProps) {
	const compact = useMediaQuery("(max-width: 720px)");
	const { step, tick } = useLoop(durations, playing, STILL_STEP);
	const loop = Math.floor(tick / durations.length);

	const lines = [];
	for (let current = loop - LOOPS_KEPT; current <= loop; current += 1) {
		for (let index = 0; index < story.beats.length; index += 1) {
			if (current === loop && index > step) continue;
			lines.push({ key: `${current}-${index}`, message: messageAt(current, index) });
		}
	}

	return (
		<Stage
			width={compact ? 360 : 460}
			height={520}
			fit={fit}
			label="Live chat with Enhancer: a streamer gives one viewer a channel badge, another a badge and a new nickname, and a viewer who supported Enhancer gets a supporter badge and a glowing name in a custom font."
		>
			<div className={`twx${compact ? " is-compact" : ""}`}>
				<div className="twx-lines">
					{lines.map(({ key, message }) => (
						<div key={key} className="twx-line">
							{message.badge && <BadgeIcon badge={message.badge} />}
							<span
								className={`twx-name${message.style ? ` is-${message.style}` : ""}`}
								style={{ color: colorOf(message.user) }}
							>
								{message.nick ?? message.user}
							</span>
							: {message.text}
							{message.emote && <EmoteIcon emote={message.emote} />}
						</div>
					))}
				</div>
				<div className="twx-input">{ui.input}</div>
			</div>
		</Stage>
	);
}
