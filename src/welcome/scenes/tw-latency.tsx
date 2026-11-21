import "./tw-latency.css";

import { locale, ui } from "./locale";
import { Stage, useLoop, useTimeline } from "./scene";

import type { SceneLocale } from "./locale";
import type { SceneProps } from "./scene";

interface Message {
	user: string;
	color: string;
	text: string;
}

const WIDTH = 340;
const HEIGHT = 480;
const VISIBLE = 14;

// Reducer settings: default rates 1.05x–1.10x, delay threshold set to 1.5s–6s.
const MIN_RATE = 1.05;
const MAX_RATE = 1.1;
const MIN_THRESHOLD = 1.5;
const MAX_THRESHOLD = 6;

// One reading per second, like the extension's 1s update interval.
const latencies = [4.86, 5.21, 4.71, 3.8, 2.86, 2.09, 1.62, 1.41, 1.38, 1.43, 1.4, 1.79, 2.67, 3.97];
const latencyDurations = latencies.map(() => 1000);
const messageDurations = [1200, 1700, 1000, 1500, 1900, 1100];

// Same formula as StreamLatencyReducerModule.setPlaybackRateMode.
const playbackRate = (latency: number) => {
	if (latency >= MAX_THRESHOLD) return MAX_RATE;
	if (latency > MIN_THRESHOLD) {
		return MIN_RATE + ((MAX_RATE - MIN_RATE) * (latency - MIN_THRESHOLD)) / (MAX_THRESHOLD - MIN_THRESHOLD);
	}
	return 1;
};

const COLORS = ["#9acd32", "#1e90ff", "#ff7f50", "#ff69b4", "#daa520", "#00d27a", "#b464ff"];

const CHAT: Record<SceneLocale, [string, string][]> = {
	en: [
		["Ludvig", "that clutch was insane"],
		["Tarek", "LETS GO"],
		["NineZ", "chat is ahead of me again lol"],
		["Klix", "clip it"],
		["Jynxzzz", "GG"],
		["CarlJacuzzi", "how is he this calm"],
		["Mizkiwi", "hi chat"],
		["Nunja", "first try?? no way"],
		["sodapopper", "go left go left"],
		["Gaulez", "W"],
		["CaseOkay", "is the stream lagging?"],
		["HasanAbby", "fine for me"],
		["Lyrik", "that timing was insane"],
		["xQz", "KEKW"],
		["shrug", "save before the boss pls"],
		["Ludvig", "he heard us"],
		["Tarek", "one more round"],
		["NineZ", "saw it before the replay"],
		["Klix", "where did he get that sword"],
		["Mizkiwi", "so clean"],
		["Nunja", "LETS GOOO"],
		["Jynxzzz", "nice"],
	],
	pl: [
		["wiktorkropkapl", "hejkaaaa!!!!"],
		["mozewinka", "oo wkońcu zmiana gierki"],
		["7isai", "to gta v ? XD"],
		["GraczekTTV", "Siema Kamiś"],
		["kloczek___", "zrobisz jakąś fabułę?"],
		["STASxSKK", "wkoncu dobra gierka"],
		["Veniakk", "szerzej"],
		["Gambit_Florydy", "ŁEEEEEEEEE"],
		["StasiekLive", "XD"],
		["oszust95", "!kaska"],
		["Niewyczochrana", "kupiłeś psa czy pożyczyłeś?"],
		["Adamproxx", "lepsze niż gta 6"],
		["demonnz1", "czemu grasz w to kamil"],
		["Pathyk", "ale czysto to zrobił"],
		["mozewinka", "jak tam piesek?"],
		["GraczekTTV", "GG"],
		["7isai", "klipuj to"],
		["kloczek___", "ale timing"],
		["Veniakk", "no i pięknie"],
		["mozewinka", "dobra gra XD"],
		["wiktorkropkapl", "dobranoc wszystkim!!!"],
	],
};

const users = [...new Set(CHAT[locale].map(([user]) => user))];
const messages: Message[] = CHAT[locale].map(([user, text]) => ({
	user,
	text,
	color: COLORS[users.indexOf(user) % COLORS.length] ?? "#9acd32",
}));

export function TwLatencyScene({ playing, fit }: SceneProps) {
	const step = useTimeline(latencyDurations, playing, 5);
	const { tick } = useLoop(messageDurations, playing, 0);
	const latency = latencies[step] ?? 1.4;
	const rate = playbackRate(latency);
	const last = tick + VISIBLE;
	const lines = Array.from({ length: VISIBLE }, (_, offset) => last - VISIBLE + offset + 1);

	return (
		<Stage
			width={WIDTH}
			height={HEIGHT}
			fit={fit}
			label="Live chat with Enhancer: the header shows the stream latency. While the delay is high, Enhancer speeds playback up slightly until the stream is close to live again."
		>
			<div className="twl">
				<div className="twl-head">
					<div className="twl-latency">
						<span className="twl-dot" />
						<span>
							{ui.latency}: {latency.toFixed(2)}s {rate !== 1 && <span className="twl-rate">({rate.toFixed(2)}x)</span>}
						</span>
					</div>
				</div>
				<div className="twl-log">
					{lines.map((index) => {
						const message = messages[index % messages.length];
						if (!message) return null;
						return (
							<div key={index} className="twl-line">
								<span className="twl-user" style={{ color: message.color }}>
									{message.user}
								</span>
								: {message.text}
							</div>
						);
					})}
				</div>
				<div className="twl-input">
					<span className="twl-placeholder">{ui.input}</span>
				</div>
				<div className="twl-actions">
					<span className="twl-chat">Chat</span>
				</div>
			</div>
		</Stage>
	);
}
