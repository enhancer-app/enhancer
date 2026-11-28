import { FaceAvatar } from "./face-avatar";
import { locale, ui } from "./locale";
import { Cursor, Stage, useTimeline } from "./scene";

import type { SceneLocale } from "./locale";
import type { SceneProps } from "./scene";

type Platform = "twitch" | "kick";
type Filter = "all" | Platform;

interface Channel {
	name: string;
	category: string;
	viewers: string;
	platform: Platform;
	tone: string;
	pinned?: boolean;
}

// Mirrors the Canary merged follow list on Twitch: sizes and colours come from the extension.
// TARGET is the kick channel the cursor pins, so the Kick filter still shows it.
const channelsByLocale: Record<SceneLocale, Channel[]> = {
	en: [
		{
			name: "xQz",
			category: "Just Chatting",
			viewers: "48.2K",
			platform: "twitch",
			tone: "#3b5b7a",
			pinned: true,
		},
		{
			name: "shrug",
			category: "Counter-Strike",
			viewers: "21.7K",
			platform: "twitch",
			tone: "#5d7a3b",
			pinned: true,
		},
		{
			name: "ibuy",
			category: "Just Chatting",
			viewers: "12.4K",
			platform: "kick",
			tone: "#7a5b3b",
		},
		{ name: "Tfoo", category: "Valorant", viewers: "9.8K", platform: "twitch", tone: "#7a3b5b" },
		{
			name: "Asmonbronze",
			category: "World of Warcraft",
			viewers: "31.5K",
			platform: "twitch",
			tone: "#3b7a6c",
		},
		{
			name: "Pokimame",
			category: "League of Legends",
			viewers: "6.1K",
			platform: "twitch",
			tone: "#6c3b7a",
		},
		{
			name: "CaiKenat",
			category: "Grand Theft Auto V",
			viewers: "67.3K",
			platform: "kick",
			tone: "#7a6c3b",
		},
		{
			name: "summit2g",
			category: "Minecraft",
			viewers: "4.9K",
			platform: "twitch",
			tone: "#3b4a7a",
		},
		{
			name: "CaseOkay",
			category: "Just Chatting",
			viewers: "3.2K",
			platform: "kick",
			tone: "#7a3b3b",
		},
	],
	pl: [
		{
			name: "Gambit_Florydy",
			category: "Just Chatting",
			viewers: "3.4K",
			platform: "twitch",
			tone: "#3b5b7a",
			pinned: true,
		},
		{
			name: "Veniakk",
			category: "Counter-Strike",
			viewers: "1.9K",
			platform: "twitch",
			tone: "#5d7a3b",
			pinned: true,
		},
		{
			name: "GraczekTTV",
			category: "Just Chatting",
			viewers: "870",
			platform: "twitch",
			tone: "#7a5b3b",
		},
		{
			name: "oszust95",
			category: "Grand Theft Auto V",
			viewers: "640",
			platform: "kick",
			tone: "#7a3b5b",
		},
		{
			name: "Niewyczochrana",
			category: "League of Legends",
			viewers: "1.2K",
			platform: "twitch",
			tone: "#3b7a6c",
		},
		{
			name: "Adamproxx",
			category: "Counter-Strike",
			viewers: "410",
			platform: "kick",
			tone: "#6c3b7a",
		},
		{
			name: "StasiekLive",
			category: "Just Chatting",
			viewers: "2.6K",
			platform: "kick",
			tone: "#7a6c3b",
		},
		{
			name: "RandomOverpowTV",
			category: "Minecraft",
			viewers: "320",
			platform: "twitch",
			tone: "#3b4a7a",
		},
		{ name: "Pathyk", category: "Valorant", viewers: "150", platform: "kick", tone: "#7a3b3b" },
	],
};
const channels = channelsByLocale[locale];

const TARGET = 6;
const LIST_TOP = 80;
const ROW = 45;
const WIDTH = 240;
const HEIGHT = 520;
const CHIP: Record<Filter, number> = { all: 26, twitch: 60, kick: 92 };
const CHIP_Y = 62;
const rowY = (slot: number) => LIST_TOP + slot * ROW;

// idle, to row, to star, pin, settle, to Kick, Kick, to Twitch, Twitch, to All, All, to star, unpin, settle
const durations = [900, 800, 450, 250, 1600, 650, 1500, 450, 1500, 450, 1300, 750, 250, 1400];
const cursorMoves = [0, 800, 450, 0, 0, 650, 0, 450, 0, 450, 0, 750, 0, 900];

export function TwitchIcon({ size = 14 }: { size?: number }) {
	return (
		<svg width={size * 0.86} height={size} viewBox="8 8 24 28" aria-hidden="true">
			<polygon points="13 8 8 13 8 31 14 31 14 36 19 31 23 31 32 22 32 8" fill="#9146ff" />
			<polygon points="26 25 30 21 30 10 14 10 14 25 18 25 18 29 22 25" fill="#fff" />
			<path d="M20 14h2v6h-2zm7 0v6h-2v-6z" fill="#9146ff" />
		</svg>
	);
}

export function KickIcon({ size = 14 }: { size?: number }) {
	return (
		<svg width={size * 0.86} height={size} viewBox="37 0 438 512" aria-hidden="true">
			<path
				d="M37 .036h164.448v113.621h54.71v-56.82h54.731V.036h164.448v170.777h-54.73v56.82h-54.711v56.8h54.71v56.82h54.73V512.03H310.89v-56.82h-54.73v-56.8h-54.711v113.62H37V.036z"
				fill="#53fc18"
			/>
		</svg>
	);
}

export function ProfilePicture({ name }: { name: string }) {
	return <FaceAvatar seed={name} className="tf-picture" />;
}

export function TwitchFollowsScene({ playing, fit }: SceneProps) {
	const step = useTimeline(durations, playing, 4);
	const targetPinned = step >= 3 && step <= 11;
	const hoverTarget = (step >= 1 && step <= 3) || (step >= 11 && step <= 12);
	const filter: Filter = step >= 6 && step <= 7 ? "kick" : step >= 8 && step <= 9 ? "twitch" : "all";

	const pinned = (index: number) => channels[index]?.pinned || (index === TARGET && targetPinned);
	const indices = channels.map((_, index) => index);
	const order = [...indices.filter(pinned), ...indices.filter((index) => !pinned(index))];
	const visible = order.filter((index) => filter === "all" || channels[index]?.platform === filter);
	const slotOf = (index: number) => visible.indexOf(index);

	const targetSlot = slotOf(TARGET) === -1 ? order.indexOf(TARGET) : slotOf(TARGET);
	const star = { x: 11, y: rowY(targetSlot) + 34 };
	const rest = { x: 190, y: 470 };
	const cursor =
		[
			rest,
			{ x: 150, y: rowY(TARGET) + 22 },
			{ x: 11, y: rowY(TARGET) + 34 },
			{ x: 11, y: rowY(TARGET) + 34 },
			star,
			{ x: CHIP.kick, y: CHIP_Y },
			{ x: CHIP.kick, y: CHIP_Y },
			{ x: CHIP.twitch, y: CHIP_Y },
			{ x: CHIP.twitch, y: CHIP_Y },
			{ x: CHIP.all, y: CHIP_Y },
			{ x: CHIP.all, y: CHIP_Y },
			star,
			star,
			rest,
		][step] ?? rest;
	const pressed = step === 3 || step === 6 || step === 8 || step === 10 || step === 12;

	return (
		<Stage
			width={WIDTH}
			height={HEIGHT}
			fit={fit}
			label="The Twitch sidebar with Enhancer shows Twitch and Kick follows in one list. A Kick channel is pinned to the top, then the list is filtered by platform."
		>
			<div className="tf">
				<div className="tf-head">
					<span>{ui.forYou}</span>
					<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
						<path d="M16 16V4h2v12h-2zM6 9l2.501-2.5-1.5-1.5-5 5 5 5 1.5-1.5-2.5-2.5h8V9H6z" />
					</svg>
				</div>
				<div className="tf-filters">
					<span className={`tf-chip tf-chip-text${filter === "all" ? " is-on" : ""}`}>All</span>
					<span className={`tf-chip${filter === "twitch" ? " is-on" : ""}`}>
						<i className="pf-dot pf-dot-twitch" />
					</span>
					<span className={`tf-chip${filter === "kick" ? " is-on" : ""}`}>
						<i className="pf-dot pf-dot-kick" />
					</span>
					<span className="tf-chip">
						<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
							<circle cx="11" cy="11" r="7" />
							<path d="m20 20-3.5-3.5" />
						</svg>
					</span>
					<span className="tf-chip tf-sort">
						<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
							<path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5" />
						</svg>
					</span>
				</div>
				{channels.map((channel, index) => {
					const slot = slotOf(index);
					const isPinned = pinned(index);
					const showStar = isPinned || (index === TARGET && hoverTarget);
					return (
						<div
							key={channel.name}
							className={`tf-row${slot === -1 ? " is-hidden" : ""}${index === TARGET && hoverTarget ? " is-hover" : ""}`}
							style={{
								transform: `translateY(${rowY(slot === -1 ? order.indexOf(index) : slot)}px)`,
							}}
						>
							<span className="tf-avatar">
								<ProfilePicture name={channel.name} />
								<span className={`tf-platform tf-platform-${channel.platform}`} />
								{showStar && <span className={`tf-pin${isPinned ? " is-pinned" : ""}`}>{isPinned ? "★" : "☆"}</span>}
							</span>
							<span className="tf-meta">
								<strong>{channel.name}</strong>
								<small>{channel.category}</small>
							</span>
							<span className="tf-viewers">
								<i />
								{channel.viewers}
							</span>
						</div>
					);
				})}
			</div>
			<Cursor x={cursor.x} y={cursor.y} duration={cursorMoves[step] ?? 0} pressed={pressed} hidden={false} />
		</Stage>
	);
}
