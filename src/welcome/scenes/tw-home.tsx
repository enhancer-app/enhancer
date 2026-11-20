import { FaceAvatar } from "./face-avatar";
import "./tw-home.css";

import { locale } from "./locale";
import { Cursor, Stage, useTimeline } from "./scene";

import type { SceneLocale } from "./locale";
import type { SceneProps } from "./scene";

type Platform = "twitch" | "kick";
type Filter = "all" | Platform;

interface Stream {
	name: string;
	platform: Platform;
	tone: string;
	title: string;
	category: string;
	pinned?: boolean;
}

interface OfflineChannel {
	name: string;
	platform: Platform;
}

// One pinned tile first, so TARGET (the tile the cursor pins) sits at slot TARGET in the All view.
const streamsByLocale: Record<SceneLocale, Stream[]> = {
	en: [
		{
			name: "xQz",
			platform: "twitch",
			tone: "#3b5b7a",
			title: "reacting to everything, all day",
			category: "Just Chatting",
			pinned: true,
		},
		{
			name: "ibuy",
			platform: "kick",
			tone: "#7a3b5b",
			title: "IRL in Tokyo, day 3",
			category: "IRL",
		},
		{
			name: "shrug",
			platform: "twitch",
			tone: "#4f6b35",
			title: "faceit grind to level 10",
			category: "Counter-Strike",
		},
		{
			name: "Tfoo",
			platform: "twitch",
			tone: "#6c3b7a",
			title: "radiant or bust",
			category: "Valorant",
		},
		{
			name: "CaiKenat",
			platform: "kick",
			tone: "#7a6236",
			title: "24h stream, chat picks the game",
			category: "Grand Theft Auto V",
		},
		{
			name: "Pokimame",
			platform: "twitch",
			tone: "#2f6e62",
			title: "cosy village build with chat",
			category: "Minecraft",
		},
		{
			name: "HasanAbby",
			platform: "twitch",
			tone: "#3b4a7a",
			title: "news, takes and long chats",
			category: "Just Chatting",
		},
	],
	pl: [
		{
			name: "Gambit_Florydy",
			platform: "twitch",
			tone: "#3b5b7a",
			title: "dzisiaj na spokojnie",
			category: "Just Chatting",
			pinned: true,
		},
		{
			name: "StasiekLive",
			platform: "kick",
			tone: "#7a3b5b",
			title: "wieczorne granie z widzami",
			category: "Counter-Strike",
		},
		{
			name: "GraczekTTV",
			platform: "twitch",
			tone: "#4f6b35",
			title: "luźny wieczór, wbijajcie",
			category: "Just Chatting",
		},
		{
			name: "oszust95",
			platform: "kick",
			tone: "#6c3b7a",
			title: "rp na mieście do rana",
			category: "Grand Theft Auto V",
		},
		{
			name: "Veniakk",
			platform: "twitch",
			tone: "#7a6236",
			title: "ranked do rana",
			category: "League of Legends",
		},
		{
			name: "Niewyczochrana",
			platform: "twitch",
			tone: "#2f6e62",
			title: "budujemy zamek, zero śmierci",
			category: "Minecraft",
		},
		{
			name: "Adamproxx",
			platform: "kick",
			tone: "#3b4a7a",
			title: "turniej z widzami, wpadajcie",
			category: "Valorant",
		},
	],
};

const offlineByLocale: Record<SceneLocale, OfflineChannel[]> = {
	en: [
		{ name: "Lyrik", platform: "kick" },
		{ name: "TimTheBatman", platform: "kick" },
		{ name: "summit2g", platform: "twitch" },
		{ name: "Asmonbronze", platform: "twitch" },
	],
	pl: [
		{ name: "chudy_macko", platform: "twitch" },
		{ name: "Pathyk", platform: "kick" },
		{ name: "MultiGameplayGuy", platform: "twitch" },
		{ name: "RandomOverpowTV", platform: "twitch" },
	],
};

const streams = streamsByLocale[locale];
const offline = offlineByLocale[locale];

const TARGET = 4;
const WIDTH = 1000;
const HEIGHT = 598;
const PAD_X = 32;
const HEADER_TOP = 24;
const GRID_TOP = HEADER_TOP + 36 + 24;
const COLUMNS = 3;
const GAP_X = 20;
const GAP_Y = 24;
const TILE_W = (WIDTH - PAD_X * 2 - GAP_X * (COLUMNS - 1)) / COLUMNS;
const MEDIA_H = (TILE_W * 9) / 16;
const TILE_H = MEDIA_H + 12 + 56;
const slotPos = (slot: number) => ({
	x: PAD_X + (slot % COLUMNS) * (TILE_W + GAP_X),
	y: GRID_TOP + Math.floor(slot / COLUMNS) * (TILE_H + GAP_Y),
});

const PILL_Y = HEADER_TOP + 18;
const PILL: Record<Filter, number> = { all: 72, twitch: 156, kick: 237 };
const counts: Record<Filter, number> = {
	all: streams.length,
	twitch: streams.filter((stream) => stream.platform === "twitch").length,
	kick: streams.filter((stream) => stream.platform === "kick").length,
};

// 0 idle, 1 to Kick, 2 press, 3 fade out, 4 Kick in, 5 Kick hold, 6 to All, 7 press, 8 fade out,
// 9 All in, 10 to tile, 11 hover, 12 preview, 13 to pin, 14 pin, 15 settle, 16 to pinned tile,
// 17 hover, 18 unpin, 19 settle, 20 rest
const durations = [
	1000, 700, 160, 90, 150, 1500, 600, 160, 90, 150, 800, 350, 1200, 450, 160, 1300, 650, 450, 160, 1100, 700,
];
const cursorMoves = [0, 700, 0, 0, 0, 0, 600, 0, 0, 0, 800, 0, 0, 450, 0, 0, 650, 0, 0, 0, 700];

function PinStar({ filled }: { filled: boolean }) {
	return (
		<span key={String(filled)} className={`twh-star${filled ? " is-filled" : " is-empty"}`}>
			{filled ? "★" : "☆"}
		</span>
	);
}

const pinOf = (slot: number) => {
	const { x, y } = slotPos(slot);
	return { x: x + TILE_W - 21, y: y + 21 };
};

export function TwHomeScene({ playing, fit }: SceneProps) {
	const step = useTimeline(durations, playing, 0);
	const filter: Filter = step >= 4 && step <= 8 ? "kick" : "all";
	const targetPinned = step >= 14 && step <= 18;
	const previewing = step >= 12 && step <= 14;
	const loading = step === 11 || step === 17;

	const pinned = (index: number) => streams[index]?.pinned || (index === TARGET && targetPinned);
	const indices = streams.map((_, index) => index);
	const order = [...indices.filter(pinned), ...indices.filter((index) => !pinned(index))];
	const visible = order.filter((index) => filter === "all" || streams[index]?.platform === filter);
	const slotOf = (index: number) => visible.indexOf(index);
	const offlineVisible = offline.filter((channel) => filter === "all" || channel.platform === filter);

	const restSlot = TARGET;
	const pinnedSlot = 1;
	const hoverSlot = step >= 11 && step <= 15 ? restSlot : step >= 17 && step <= 19 ? pinnedSlot : -1;
	const tile = slotPos(restSlot);
	const tileCentre = { x: tile.x + TILE_W * 0.55, y: tile.y + MEDIA_H * 0.6 };
	const rest = { x: 760, y: 520 };
	const kick = { x: PILL.kick, y: PILL_Y };
	const all = { x: PILL.all, y: PILL_Y };
	const cursor =
		[
			rest,
			kick,
			kick,
			kick,
			kick,
			kick,
			all,
			all,
			all,
			all,
			tileCentre,
			tileCentre,
			tileCentre,
			pinOf(restSlot),
			pinOf(restSlot),
			pinOf(restSlot),
			pinOf(pinnedSlot),
			pinOf(pinnedSlot),
			pinOf(pinnedSlot),
			pinOf(pinnedSlot),
			rest,
		][step] ?? rest;
	const pressed = step === 2 || step === 7 || step === 14 || step === 18;

	return (
		<Stage
			width={WIDTH}
			height={HEIGHT}
			fit={fit}
			label="Enhancer's followed streams home page: live Twitch and Kick channels in one grid, filtered to Kick and back, then a stream is pinned to the front."
		>
			<div className="twh">
				<header className="twh-header" style={{ top: HEADER_TOP }}>
					<div className="twh-filters">
						{(["all", "twitch", "kick"] as const).map((option) => (
							<span
								key={option}
								className={`twh-pill${filter === option ? " is-on" : ""}`}
								aria-label={option === "all" ? undefined : option}
							>
								{option === "all" ? "All" : <span className={`pf-dot pf-dot-${option}`} />}
								<span className="twh-count">{counts[option]}</span>
							</span>
						))}
						<span className="twh-sort">
							<span className="sk" style={{ width: 44 }} />
							<span className="sk sk-strong" style={{ width: 72 }} />
						</span>
					</div>
					<span className="twh-original">
						<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
							<path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
						</svg>
						Original home
					</span>
				</header>

				<section
					className="twh-offline"
					style={{
						transform: `translateY(${GRID_TOP + Math.ceil(visible.length / COLUMNS) * (TILE_H + GAP_Y)}px)`,
					}}
				>
					<div className="twh-offline-title">
						Offline <span>{offlineVisible.length}</span>
					</div>
					<div className="twh-offline-grid">
						{offlineVisible.map((channel) => (
							<span key={channel.name} className="twh-offline-row">
								<span className="twh-offline-avatar">
									<FaceAvatar seed={channel.name} className="twh-face" />
									<span className={`twh-dot twh-dot-${channel.platform}`} />
								</span>
								<span className="twh-offline-name">{channel.name}</span>
							</span>
						))}
					</div>
				</section>

				{streams.map((stream, index) => {
					const slot = slotOf(index);
					const position = slotPos(slot === -1 ? order.indexOf(index) : slot);
					const isPinned = pinned(index);
					const isHovered = slot !== -1 && slot === hoverSlot;
					return (
						<article
							key={stream.name}
							className={`twh-tile twh-tile-${stream.platform}${slot === -1 ? " is-hidden" : ""}${isHovered ? " is-hover" : ""}`}
							style={{
								width: TILE_W,
								transform: `translate(${position.x}px, ${position.y}px)`,
								["--tone" as string]: stream.tone,
							}}
							aria-label={`${stream.name} (${stream.platform})`}
						>
							<div className="twh-media" style={{ height: MEDIA_H }}>
								<span className={`twh-still${isHovered && index === TARGET && previewing ? " is-playing" : ""}`} />
								{isHovered && index === TARGET && loading && <span className="twh-loader" />}
								<span className="twh-live">LIVE</span>
								<span className={`twh-pin${isPinned ? " is-pinned" : ""}`}>
									<PinStar filled={!!isPinned} />
								</span>
								<span className="twh-stat twh-stat-left">
									<span className="sk" style={{ width: 34, height: 6 }} />
								</span>
								<span className="twh-stat twh-stat-right">
									<span className="sk" style={{ width: 20, height: 6 }} />
								</span>
							</div>
							<div className="twh-info">
								<span className="twh-avatar">
									<FaceAvatar seed={stream.name} className="twh-face" />
									<span className={`twh-dot twh-dot-${stream.platform}`} />
								</span>
								<span className="twh-text">
									<span className="twh-title">{stream.title}</span>
									<span className="twh-name">{stream.name}</span>
									<span className="twh-category">{stream.category}</span>
								</span>
							</div>
						</article>
					);
				})}
			</div>
			<Cursor x={cursor.x} y={cursor.y} duration={cursorMoves[step] ?? 0} pressed={pressed} hidden={false} />
		</Stage>
	);
}
