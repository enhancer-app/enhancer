import "./tw-grouping.css";

import { locale, ui } from "./locale";
import { Stage, useTimeline } from "./scene";

import type { SceneLocale } from "./locale";
import type { SceneProps } from "./scene";

const WIDTH = 340;
const HEIGHT = 480;
const COLORS = ["#9acd32", "#1e90ff", "#ff7f50", "#ff69b4", "#daa520", "#00d27a", "#b464ff"];

const CHAT: Record<SceneLocale, [string, string][]> = {
	en: [
		["Ludvig", "that clutch was insane"],
		["Ludvig", "no way he hit that"],
		["Ludvig", "CLIP IT"],
		["Tarek", "LETS GO"],
		["Mizkiwi", "hi chat"],
		["Mizkiwi", "just got here"],
		["Mizkiwi", "what did I miss?"],
		["NineZ", "chat is ahead of me again lol"],
		["Klix", "GG"],
		["Klix", "one more round pls"],
		["Nunja", "first try?? no way"],
		["Nunja", "he's actually cracked"],
		["sodapopper", "W stream"],
	],
	pl: [
		["mozewinka", "oo wkońcu zmiana gierki"],
		["mozewinka", "to gta v?"],
		["mozewinka", "XD"],
		["GraczekTTV", "Siema Kamiś"],
		["kloczek___", "zrobisz jakąś fabułę?"],
		["kloczek___", "albo chociaż misje"],
		["kloczek___", "pls"],
		["Veniakk", "szerzej"],
		["7isai", "klipuj to"],
		["7isai", "ale timing"],
		["Pathyk", "ale czysto to zrobił"],
		["Pathyk", "GG"],
		["StasiekLive", "dobranoc wszystkim!!!"],
	],
};

const LABEL: Record<SceneLocale, string> = { en: "Group messages", pl: "Grupuj wiadomości" };

const chat = CHAT[locale];
const users = [...new Set(chat.map(([user]) => user))];
const lines = chat.map(([user, text], index) => ({
	user,
	text,
	color: COLORS[users.indexOf(user) % COLORS.length] ?? "#9acd32",
	continued: index > 0 && chat[index - 1]?.[0] === user,
}));

const durations = [3000, 3400];

export function TwGroupingScene({ playing, fit }: SceneProps) {
	const grouped = useTimeline(durations, playing, 1) === 1;

	return (
		<Stage
			width={WIDTH}
			height={HEIGHT}
			fit={fit}
			label="Live chat with Enhancer's message grouping: when one person sends several messages in a row, their name is shown only on the first one."
		>
			<div className={`twg${grouped ? " is-grouped" : ""}`}>
				<div className="twg-head">
					<span>{LABEL[locale]}</span>
					<span className="twg-switch" />
				</div>
				<div className="twg-log">
					{lines.map((line, index) => (
						<div key={index} className={`twg-line${line.continued ? " is-continued" : ""}`}>
							<span className="twg-user" style={{ color: line.color }}>
								{line.user}:{" "}
							</span>
							{line.text}
						</div>
					))}
				</div>
				<div className="twg-input">
					<span>{ui.input}</span>
				</div>
			</div>
		</Stage>
	);
}
