import "./tw-hero.css";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { FaceAvatar } from "./face-avatar";
import { locale, ui } from "./locale";
import { Stage, useLoop, useMediaQuery } from "./scene";
import { ProfilePicture } from "./twitch-follows";

import type { FormEvent, ReactNode } from "react";
import type { SceneLocale } from "./locale";
import type { SceneProps } from "./scene";

type Platform = "twitch" | "kick";

interface Channel {
	name: string;
	category: string;
	viewers: string;
	platform: Platform;
	pinned?: boolean;
}

interface Stream {
	channel: string;
	title: string;
	viewers: number;
	chatters: number;
	/** Chatters added on top of `chatters` at each latency step. */
	drift: number[];
	sidebar: Channel[];
	/** Sidebar row that gets pinned and unpinned during the loop. */
	target: number;
	chat: [string, string][];
}

const STREAMS: Record<SceneLocale, Stream> = {
	en: {
		channel: "CaiKenat",
		title: "late night stream with chat · new setup tour",
		viewers: 12847,
		chatters: 11532,
		drift: [0, 0, 9, 9, 17, 17, 26, 26, 31, 31, 22, 22, 11],
		sidebar: [
			{
				name: "xQz",
				category: "Just Chatting",
				viewers: "48.2K",
				platform: "twitch",
				pinned: true,
			},
			{
				name: "shrug",
				category: "Counter-Strike",
				viewers: "21.7K",
				platform: "twitch",
				pinned: true,
			},
			{ name: "CaiKenat", category: "Just Chatting", viewers: "12.8K", platform: "kick" },
			{ name: "ibuy", category: "Just Chatting", viewers: "12.4K", platform: "kick" },
			{ name: "Tfoo", category: "Valorant", viewers: "9.8K", platform: "twitch" },
			{ name: "Pokimame", category: "League of Legends", viewers: "6.1K", platform: "twitch" },
			{
				name: "Asmonbronze",
				category: "World of Warcraft",
				viewers: "31.5K",
				platform: "twitch",
			},
			{ name: "summit2g", category: "Minecraft", viewers: "4.9K", platform: "twitch" },
			{ name: "CaseOkay", category: "Just Chatting", viewers: "3.2K", platform: "kick" },
			{ name: "HasanAbby", category: "Just Chatting", viewers: "2.8K", platform: "twitch" },
		],
		target: 3,
		chat: [
			["Ludvig", "hi chat catWave"],
			["Tarek", "the new desk looks so clean"],
			["NineZ", "show the mic again"],
			["Klix", "LETSGO"],
			["Jynxzzz", "is that a new chair?"],
			["CarlJacuzzi", "lights look way better glimWow"],
			["Mizkiwi", "glimLOL glimLOL"],
			["Nunja", "stream feels so smooth today"],
			["sodapopper", "monitor arm W"],
			["Ludvig", "do the room tour next"],
			["Tarek", "glimLove"],
			["NineZ", "cable management 10/10"],
			["Klix", "where is the plant from"],
			["Jynxzzz", "GGwp"],
			["CarlJacuzzi", "chat he's reading everything"],
			["Mizkiwi", "late night streams are the best"],
			["Nunja", "glimHappy"],
			["sodapopper", "one more song pls"],
		],
	},
	pl: {
		channel: "demonnz1",
		title: "czekanie aż gucik wyłączy lajwa :((( Pozdrawiam <3",
		viewers: 312,
		chatters: 287,
		drift: [0, 0, 1, 1, 3, 3, 4, 4, 5, 5, 3, 3, 1],
		sidebar: [
			{
				name: "Gambit_Florydy",
				category: "Just Chatting",
				viewers: "3.4K",
				platform: "twitch",
				pinned: true,
			},
			{
				name: "Veniakk",
				category: "Counter-Strike",
				viewers: "1.9K",
				platform: "twitch",
				pinned: true,
			},
			{ name: "demonnz1", category: "Just Chatting", viewers: "312", platform: "twitch" },
			{ name: "StasiekLive", category: "Just Chatting", viewers: "2.6K", platform: "kick" },
			{ name: "GraczekTTV", category: "Just Chatting", viewers: "870", platform: "twitch" },
			{ name: "oszust95", category: "Grand Theft Auto V", viewers: "640", platform: "kick" },
			{
				name: "Niewyczochrana",
				category: "League of Legends",
				viewers: "1.2K",
				platform: "twitch",
			},
			{ name: "Adamproxx", category: "Counter-Strike", viewers: "410", platform: "kick" },
			{ name: "RandomOverpowTV", category: "Minecraft", viewers: "320", platform: "twitch" },
			{ name: "Pathyk", category: "Valorant", viewers: "150", platform: "kick" },
		],
		target: 3,
		chat: [
			["wiktorkropkapl", "hejkaaaa!!!! catWave"],
			["mozewinka", "kupiłeś psa czy pożyczyłeś?"],
			["7isai", "Siema Kamiś"],
			["GraczekTTV", "oo wkońcu zmiana gierki"],
			["kloczek___", "XD"],
			["STASxSKK", "glimLOL glimLOL"],
			["Pathyk", "gambit jeszcze gra?"],
			["mozewinka", "jak tam piesek?"],
			["wiktorkropkapl", "LETSGO"],
			["7isai", "czekamy razem glimHappy"],
			["GraczekTTV", "pozdro z pracy"],
			["kloczek___", "glimWow"],
			["STASxSKK", "ile jeszcze czekamy XD"],
			["Pathyk", "pozdrawiam <3"],
			["mozewinka", "glimLove"],
			["7isai", "dobra muzyka leci"],
		],
	},
};
const stream = STREAMS[locale];

const WIDTH = 1200;
const HEIGHT = 464;
const COMPACT_WIDTH = 360;
const COMPACT_HEIGHT = 600;
const ROW = 45;
const LIST_TOP = 80;

// Reducer settings: default rates 1.05x–1.10x, delay threshold set to 1.5s–6s.
const MIN_RATE = 1.05;
const MAX_RATE = 1.1;
const MIN_THRESHOLD = 1.5;
const MAX_THRESHOLD = 6;

// One reading per second; the reducer catches up, then the delay drifts back for the next loop.
const latencies = [4.08, 3.94, 3.52, 2.91, 2.3, 1.84, 1.52, 1.41, 1.38, 1.42, 1.39, 1.87, 2.96];
const latencyDurations = latencies.map(() => 1000);
const messageDurations = [1300, 1800, 1100, 1600, 2000, 1200];
const VISIBLE = 11;
const COMPACT_VISIBLE = 12;

// Same formula as StreamLatencyReducerModule.setPlaybackRateMode.
const playbackRate = (latency: number) => {
	if (latency >= MAX_THRESHOLD) return MAX_RATE;
	if (latency > MIN_THRESHOLD) {
		return MIN_RATE + ((MAX_RATE - MIN_RATE) * (latency - MIN_THRESHOLD)) / (MAX_THRESHOLD - MIN_THRESHOLD);
	}
	return 1;
};

// Same format as the extension: plain below 10 000, space-grouped above.
const formatChatters = (value: number) =>
	value < 10000 ? value.toString() : value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const COLORS = ["#9acd32", "#1e90ff", "#ff7f50", "#ff69b4", "#daa520", "#00d27a", "#b464ff"];
const chatUsers = [...new Set(stream.chat.map(([user]) => user))];
const colorOf = (user: string) => COLORS[chatUsers.indexOf(user) % COLORS.length] ?? "#9acd32";

// A smaller copy of the emote set from the emote bar scene, drawn on a 28x28 grid.
const face = (fill: string, children: ReactNode) => (
	<>
		<circle cx="14" cy="14" r="12.5" fill={fill} />
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
		</>
	),
	catWave: (
		<>
			<path d="M4 4.5l6 4.5h8l6-4.5-.8 9.5C23.5 20.5 19.5 24.5 14 24.5S4.5 20.5 4.8 14z" fill="#f29a4a" />
			<path
				d="M9 14.2c.8-1 2-1 2.8 0M16.2 14.2c.8-1 2-1 2.8 0"
				fill="none"
				stroke="#3b2414"
				strokeWidth="1.6"
				strokeLinecap="round"
			/>
			<path d="M12.8 17.4h2.4L14 18.7z" fill="#e0607a" />
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
		</>,
	),
	glimLove: (
		<>
			<path
				d="M14 24.5S3 17.8 3 10.3C3 6.8 5.6 4.5 8.6 4.5c2.4 0 4.3 1.4 5.4 3.3 1.1-1.9 3-3.3 5.4-3.3 3 0 5.6 2.3 5.6 5.8 0 7.5-11 14.2-11 14.2z"
				fill="#ff4f73"
			/>
			<circle cx="10.5" cy="12.5" r="1.4" fill="#5c1020" />
			<circle cx="17.5" cy="12.5" r="1.4" fill="#5c1020" />
		</>
	),
	GGwp: (
		<>
			<rect x="2" y="3" width="24" height="22" rx="5" fill="#7d5cff" />
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
} satisfies Record<string, ReactNode>;

type EmoteName = keyof typeof EMOTES;

const BAR: EmoteName[] = [
	"glimLOL",
	"catWave",
	"LETSGO",
	"glimWow",
	"Gleep",
	"glimHappy",
	"glimLove",
	"GGwp",
	"glimFire",
];

const isEmote = (word: string): word is EmoteName => Object.hasOwn(EMOTES, word);
const ratioOf = (name: EmoteName) => (name === "LETSGO" ? 2 : 1);

function Emote({ name, height }: { name: EmoteName; height: number }) {
	return (
		<svg
			className="twr-emote"
			width={height * ratioOf(name)}
			height={height}
			viewBox={`0 0 ${28 * ratioOf(name)} 28`}
			aria-label={name}
		>
			{EMOTES[name]}
		</svg>
	);
}

type Filter = "all" | Platform;

const TEXT: Record<
	SceneLocale,
	{
		me: string;
		pin: string;
		unpin: string;
		filters: string;
		all: string;
		purple: string;
		green: string;
		insert: string;
		input: string;
	}
> = {
	en: {
		me: "you",
		pin: "Pin",
		unpin: "Unpin",
		filters: "Filter followed channels",
		all: "All channels",
		purple: "Channels with a purple dot",
		green: "Channels with a green dot",
		insert: "Insert emote",
		input: "Send a message",
	},
	pl: {
		me: "ty",
		pin: "Przypnij",
		unpin: "Odepnij",
		filters: "Filtruj obserwowane kanały",
		all: "Wszystkie kanały",
		purple: "Kanały z fioletową kropką",
		green: "Kanały z zieloną kropką",
		insert: "Wstaw emotkę",
		input: "Wyślij wiadomość",
	},
};
const text = TEXT[locale];
const ME_COLOR = "#bf94ff";
const MAX_LENGTH = 80;

// The loop pins the target on step 3 and unpins it after step 9.
const autoPins = (step: number) => {
	const targetPinned = step >= 3 && step <= 9;
	return new Set(
		stream.sidebar
			.filter((channel, index) => channel.pinned || (index === stream.target && targetPinned))
			.map((channel) => channel.name),
	);
};

interface SidebarProps {
	step: number;
	pins: Set<string> | null;
	filter: Filter;
	onPin: (name: string) => void;
	onFilter: (filter: Filter) => void;
}

function Sidebar({ step, pins, filter, onPin, onFilter }: SidebarProps) {
	const { sidebar, target, channel: current } = stream;
	const pinnedNames = pins ?? autoPins(step);
	const hoverTarget = pins === null && (step === 2 || step === 9);
	const pinned = (index: number) => pinnedNames.has(sidebar[index]?.name ?? "");
	const indices = sidebar.map((_, index) => index);
	const order = [...indices.filter(pinned), ...indices.filter((index) => !pinned(index))];
	const visible = order.filter((index) => filter === "all" || sidebar[index]?.platform === filter);
	const chips: { id: Filter; label: string; content: ReactNode }[] = [
		{ id: "all", label: text.all, content: "All" },
		{ id: "twitch", label: text.purple, content: <i className="pf-dot pf-dot-twitch" /> },
		{ id: "kick", label: text.green, content: <i className="pf-dot pf-dot-kick" /> },
	];

	return (
		<div className="tf twr-sidebar">
			<div className="tf-head" aria-hidden="true">
				<span>{ui.forYou}</span>
				<svg width="20" height="20" viewBox="0 0 20 20">
					<path d="M16 16V4h2v12h-2zM6 9l2.501-2.5-1.5-1.5-5 5 5 5 1.5-1.5-2.5-2.5h8V9H6z" />
				</svg>
			</div>
			<div className="tf-filters">
				<fieldset className="twr-chips" aria-label={text.filters}>
					{chips.map((chip) => (
						<button
							key={chip.id}
							type="button"
							className={`tf-chip twr-chip${chip.id === "all" ? " tf-chip-text" : ""}${filter === chip.id ? " is-on" : ""}`}
							aria-label={chip.label}
							aria-pressed={filter === chip.id}
							onClick={() => onFilter(chip.id)}
						>
							{chip.content}
						</button>
					))}
				</fieldset>
				<span className="tf-chip" aria-hidden="true">
					<svg width="16" height="16" viewBox="0 0 24 24">
						<circle cx="11" cy="11" r="7" />
						<path d="m20 20-3.5-3.5" />
					</svg>
				</span>
				<span className="tf-chip tf-sort" aria-hidden="true">
					<svg width="16" height="16" viewBox="0 0 24 24">
						<path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5" />
					</svg>
				</span>
			</div>
			<ul className="twr-rows">
				{sidebar.map((channel, index) => {
					const isPinned = pinned(index);
					const slot = visible.indexOf(index);
					const hovered = index === target && hoverTarget;
					return (
						<li
							key={channel.name}
							className={`tf-row${slot === -1 ? " is-hidden" : ""}${hovered ? " is-hover" : ""}${channel.name === current ? " twr-current" : ""}`}
							style={{
								transform: `translateY(${LIST_TOP + (slot === -1 ? order.indexOf(index) : slot) * ROW}px)`,
							}}
						>
							<span className="tf-avatar">
								<ProfilePicture name={channel.name} />
								<span className={`tf-platform tf-platform-${channel.platform}`} />
								<button
									type="button"
									className={`tf-pin twr-pin${isPinned ? " is-pinned" : ""}`}
									aria-label={`${isPinned ? text.unpin : text.pin} ${channel.name}`}
									aria-pressed={isPinned}
									tabIndex={slot === -1 ? -1 : undefined}
									onClick={() => onPin(channel.name)}
								>
									{isPinned ? "★" : "☆"}
								</button>
							</span>
							<span className="tf-meta">
								<strong>{channel.name}</strong>
								<small>{channel.category}</small>
							</span>
							<span className="tf-viewers">
								<i />
								{channel.viewers}
							</span>
						</li>
					);
				})}
			</ul>
		</div>
	);
}

const TIP = ui.chattersTip;

type Tip = "auto" | "open" | "closed";

function Info({ chatters, onRefresh }: { chatters: number; onRefresh: () => void }) {
	const tipId = useId();
	const [tip, setTip] = useState<Tip>("auto");
	const [refreshing, setRefreshing] = useState(false);

	// A click dims the count briefly like the request in scene 02, and keeps the tip up for touch.
	useEffect(() => {
		if (!refreshing) return;
		const timer = window.setTimeout(() => {
			setRefreshing(false);
			onRefresh();
		}, 350);
		return () => window.clearTimeout(timer);
	}, [refreshing, onRefresh]);
	useEffect(() => {
		if (tip !== "open") return;
		const timer = window.setTimeout(() => setTip("auto"), 2500);
		return () => window.clearTimeout(timer);
	}, [tip]);

	return (
		<div className="twr-info">
			<div className="twr-avatar">
				<FaceAvatar seed={stream.channel} className="twr-avatar-pic" />
				<span className="twr-live">LIVE</span>
			</div>
			<div className="twr-text">
				<div className="twr-name">{stream.channel}</div>
				<div className="twr-title">{stream.title}</div>
				<div className="twr-meta">
					<span className="twr-category">Just Chatting</span>
				</div>
			</div>
			<div className="twr-side">
				<div className="twr-viewers">
					<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
						<circle cx="10" cy="7" r="3.6" />
						<path d="M3.5 17.5c.4-3.6 3-5.6 6.5-5.6s6.1 2 6.5 5.6" />
					</svg>
					<strong>{stream.viewers.toLocaleString("en-US")}</strong>
					<span className={`twr-chatters is-tip-${tip}`}>
						<button
							type="button"
							className={`twr-count${refreshing ? " is-refreshing" : ""}`}
							aria-describedby={tipId}
							onClick={() => {
								setRefreshing(true);
								setTip("open");
							}}
							onKeyDown={(event) => {
								if (event.key === "Escape") setTip("closed");
							}}
							onBlur={() => setTip("auto")}
						>
							({formatChatters(chatters)})
						</button>
						<span id={tipId} role="tooltip" className="twr-tip">
							<i />
							{TIP}
						</span>
					</span>
				</div>
			</div>
		</div>
	);
}

interface OwnMessage {
	id: number;
	/** Index of the scripted message it was sent after. */
	after: number;
	text: string;
}

interface ChatProps {
	latency: number;
	tick: number;
	visible: number;
	own: OwnMessage[];
	bar: EmoteName[];
	draft: string;
	onDraft: (draft: string) => void;
	onSend: () => void;
	onSendEmote: (name: EmoteName) => void;
}

function MessageText({ value }: { value: string }) {
	return value.split(" ").map((word, position) => (
		<span key={position}>
			{position > 0 && " "}
			{isEmote(word) ? <Emote name={word} height={22} /> : word}
		</span>
	));
}

function Chat({ latency, tick, visible, own, bar, draft, onDraft, onSend, onSendEmote }: ChatProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const rate = playbackRate(latency);
	const newest = tick + visible - 1;
	const lines: { key: string; user: string; color: string; text: string }[] = [];
	for (let index = newest - visible + 1; index <= newest; index += 1) {
		const [user, message] = stream.chat[index % stream.chat.length] ?? ["", ""];
		lines.push({ key: `a${index}`, user, color: colorOf(user), text: message });
		for (const entry of own) {
			if (entry.after === index) {
				lines.push({ key: `o${entry.id}`, user: text.me, color: ME_COLOR, text: entry.text });
			}
		}
	}

	const submit = (event: FormEvent) => {
		event.preventDefault();
		onSend();
	};
	const insert = (name: EmoteName) => {
		const spaced = draft && !draft.endsWith(" ") ? `${draft} ` : draft;
		const next = `${spaced}${name} `;
		if (next.length <= MAX_LENGTH) onDraft(next);
		inputRef.current?.focus();
	};

	return (
		<div className="twr-chat">
			<div className="twr-chat-head">
				<span className="twr-dot" />
				<span>
					{ui.latency}: {latency.toFixed(2)}s {rate !== 1 && <span className="twr-rate">({rate.toFixed(2)}x)</span>}
				</span>
			</div>
			<div className="twr-log">
				{lines.slice(-visible).map((line) => (
					<div key={line.key} className="twr-line">
						<span className="twr-user" style={{ color: line.color }}>
							{line.user}
						</span>
						<span>: </span>
						<MessageText value={line.text} />
					</div>
				))}
			</div>
			<form className="twr-input-area" onSubmit={submit}>
				<div className="twr-bar">
					{bar.map((name) => (
						<button
							key={name}
							type="button"
							className="twr-bar-button"
							aria-label={`${text.insert} ${name}`}
							onClick={(event) => {
								// Like the extension: Ctrl or Cmd sends the emote right away.
								if (event.ctrlKey || event.metaKey) onSendEmote(name);
								else insert(name);
							}}
						>
							<Emote name={name} height={22} />
						</button>
					))}
				</div>
				<input
					ref={inputRef}
					className="twr-input"
					type="text"
					name="message"
					value={draft}
					maxLength={MAX_LENGTH}
					placeholder={ui.input}
					aria-label={text.input}
					autoComplete="off"
					enterKeyHint="send"
					onInput={(event) => onDraft(event.currentTarget.value)}
				/>
			</form>
		</div>
	);
}

type Uses = Partial<Record<EmoteName, { count: number; last: number }>>;

// Frecency like the emote bar: most used first, then most recent, then the default order.
const orderBar = (uses: Uses) =>
	BAR.toSorted(
		(a, b) =>
			(uses[b]?.count ?? 0) - (uses[a]?.count ?? 0) ||
			(uses[b]?.last ?? 0) - (uses[a]?.last ?? 0) ||
			BAR.indexOf(a) - BAR.indexOf(b),
	);

export function TwHeroScene({ playing, fit }: SceneProps) {
	const compact = useMediaQuery("(max-width: 720px)");
	const step = useLoop(latencyDurations, playing, 8).step;
	const { tick } = useLoop(messageDurations, playing, 0);
	const latency = latencies[step] ?? 1.4;
	const [refreshBump, setRefreshBump] = useState(0);
	const chatters = stream.chatters + (stream.drift[step] ?? 0) + refreshBump;
	// Once the visitor touches the sidebar, the scripted pin and unpin stop.
	const [pins, setPins] = useState<Set<string> | null>(null);
	const [filter, setFilter] = useState<Filter>("all");
	const [draft, setDraft] = useState("");
	const [own, setOwn] = useState<OwnMessage[]>([]);
	const [uses, setUses] = useState<Uses>({});
	const refresh = useCallback(() => {
		// Alternating small steps keep the count close to the scripted one.
		setRefreshBump((current) => (current > 0 ? current - 2 : current + 3));
	}, []);
	const visible = compact ? COMPACT_VISIBLE : VISIBLE;

	const takeOver = () => pins ?? autoPins(step);
	const togglePin = (name: string) => {
		const next = new Set(takeOver());
		if (next.has(name)) next.delete(name);
		else next.add(name);
		setPins(next);
	};
	const changeFilter = (next: Filter) => {
		setPins(takeOver());
		setFilter(next);
	};
	const post = (value: string) => {
		const message = value.trim().replace(/\s+/g, " ").slice(0, MAX_LENGTH);
		if (!message) return false;
		const id = (own.at(-1)?.id ?? 0) + 1;
		setOwn([...own.slice(-20), { id, after: tick + visible - 1, text: message }]);
		const nextUses = { ...uses };
		for (const word of message.split(" ")) {
			if (isEmote(word)) nextUses[word] = { count: (nextUses[word]?.count ?? 0) + 1, last: id };
		}
		setUses(nextUses);
		return true;
	};
	const send = () => {
		if (post(draft)) setDraft("");
	};

	const chat = (
		<Chat
			latency={latency}
			tick={tick}
			visible={visible}
			own={own}
			bar={orderBar(uses)}
			draft={draft}
			onDraft={setDraft}
			onSend={send}
			onSendEmote={post}
		/>
	);

	return (
		<Stage
			width={compact ? COMPACT_WIDTH : WIDTH}
			height={compact ? COMPACT_HEIGHT : HEIGHT}
			fit={fit}
			interactive
			label="A live channel page with Enhancer: followed channels from both platforms in one sidebar with pinned channels, the chatters count next to viewers, an emote bar above the chat input and a latency readout that speeds playback up until the stream is close to live."
		>
			{compact ? (
				<div className="twr is-compact">
					<Info chatters={chatters} onRefresh={refresh} />
					{chat}
				</div>
			) : (
				<div className="twr">
					<Sidebar step={step} pins={pins} filter={filter} onPin={togglePin} onFilter={changeFilter} />
					<div className="twr-main">
						<div className="twr-player" aria-hidden="true">
							<span className="twr-player-live">LIVE</span>
						</div>
						<Info chatters={chatters} onRefresh={refresh} />
					</div>
					{chat}
				</div>
			)}
		</Stage>
	);
}
