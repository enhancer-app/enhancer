import "./welcome.css";
import "./scenes/scenes.css";

import type {
	Accent,
	WelcomeConfirmation,
	WelcomeFeature,
	WelcomeFeatureId,
	WelcomeFeatureState,
	WelcomePlatform,
} from "$types/welcome/welcome.types.ts";
import { Fragment, render } from "preact";
import type { ComponentType } from "react";
import { useEffect, useRef, useState } from "react";
import { locale } from "./scenes/locale.ts";
import type { SceneProps } from "./scenes/scene.tsx";
import { TwAttachmentsScene } from "./scenes/tw-attachments.tsx";
import { TwEmoteBarScene } from "./scenes/tw-emotebar.tsx";
import { TwGroupingScene } from "./scenes/tw-grouping.tsx";
import { TwHomeScene } from "./scenes/tw-home.tsx";
import { TwLatencyScene } from "./scenes/tw-latency.tsx";
import { TwitchFollowsScene } from "./scenes/twitch-follows.tsx";
import { copy, features, links } from "./welcome.content.ts";
import { readFeatureState, writeFeature } from "./welcome.settings.ts";

type SceneComponent = ComponentType<SceneProps>;

const LOGO = "/assets/enhancer/logo-128.png";
const ADVANCE_AFTER_ENABLE_MS = 900;
const TOTAL = features.length + 2;

const scenes: Record<WelcomeFeatureId, SceneComponent> = {
	follows: TwitchFollowsScene,
	home: TwHomeScene,
	attachments: TwAttachmentsScene,
	latency: TwLatencyScene,
	emotebar: TwEmoteBarScene,
	grouping: TwGroupingScene,
};

const slideTitle = (index: number) => {
	if (index === 0) return copy.intro.title.join("");
	if (index === TOTAL - 1) return copy.done.kicker;
	const feature = features[index - 1];
	return feature ? copy.features[feature.id].title : "";
};

function SceneSlot({ scene: Scene }: { scene: SceneComponent }) {
	const ref = useRef<HTMLDivElement>(null);
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		const observer = new IntersectionObserver(([entry]) => setVisible(entry?.isIntersecting ?? false));
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	return (
		<div ref={ref} className="scene-slot">
			<Scene playing={visible} fit />
		</div>
	);
}

function Accented({ text }: { text: Accent }) {
	return (
		<>
			{text[0]}
			<em>{text[1]}</em>
		</>
	);
}

function PlatformTags({ platforms }: { platforms: WelcomePlatform[] }) {
	return (
		<ul className="platforms" aria-label={copy.feature.available}>
			{platforms.map((platform) => (
				<li key={platform} data-platform={platform.toLowerCase()}>
					{platform}
				</li>
			))}
		</ul>
	);
}

function Arrow({ direction }: { direction: "left" | "right" }) {
	return (
		<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
			<path d={direction === "left" ? "M19 12H5M11 6l-6 6 6 6" : "M5 12h14M13 6l6 6-6 6"} />
		</svg>
	);
}

function Check() {
	return (
		<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
			<path d="M5 12.5l4.5 4.5L19 7.5" />
		</svg>
	);
}

function CloseIcon() {
	return (
		<svg className="ob-close-icon" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
			<path d="M6 6l12 12M18 6L6 18" />
		</svg>
	);
}

function ExitActions() {
	return (
		<div className="ob-exit-actions">
			<a className="ob-exit-button" href={links.twitch}>
				<span className="pf-dot pf-dot-twitch" aria-hidden="true" />
				{copy.intro.openTwitch}
			</a>
			<a className="ob-exit-button" href={links.kick}>
				<span className="pf-dot pf-dot-kick" aria-hidden="true" />
				{copy.intro.openKick}
			</a>
			<button type="button" className="ob-exit-button" onClick={closePage}>
				<CloseIcon />
				{copy.intro.close}
			</button>
		</div>
	);
}

async function closePage() {
	const tab = await chrome.tabs.getCurrent().catch(() => undefined);
	if (tab?.id !== undefined) await chrome.tabs.remove(tab.id);
	else window.close();
}

function IntroSlide({ onStart }: { onStart: () => void }) {
	return (
		<>
			<div className="ob-copy">
				<h1>
					<Accented text={copy.intro.title} />
				</h1>
				<p className="section-lede">{copy.intro.lede}</p>
			</div>
			<div className="ob-cta">
				<button type="button" className="button" onClick={onStart}>
					{copy.intro.start} →
				</button>
			</div>
			<div className="ob-exit">
				<p>{copy.intro.notInterested}</p>
				<ExitActions />
			</div>
		</>
	);
}

type FeatureSlideProps = {
	feature: WelcomeFeature;
	index: number;
	state: WelcomeFeatureState;
	onToggle: (feature: WelcomeFeature, value: boolean) => Promise<boolean>;
};

const requiredFeature = (feature: WelcomeFeature) => features.find((item) => item.id === feature.requires);

function FeatureSlide({ feature, index, state, onToggle }: FeatureSlideProps) {
	const text = copy.features[feature.id];
	const [saving, setSaving] = useState(false);
	const [failed, setFailed] = useState(false);
	const enabled = state[feature.id] === true;
	const required = requiredFeature(feature);
	const turnsOnRequired = required !== undefined && state[required.id] !== true;

	const toggle = async (value: boolean) => {
		setSaving(true);
		setFailed(false);
		const saved = await onToggle(feature, value);
		setSaving(false);
		setFailed(!saved);
	};

	return (
		<>
			<div className="ob-copy">
				<span className="ob-index">{String(index).padStart(2, "0")}</span>
				<h2>{text.title}</h2>
				<p className="section-lede">{text.description}</p>
				<PlatformTags platforms={feature.platforms} />
				{text.note && <p className={`ob-note${text.warning ? " ob-note-warn" : ""}`}>{text.note}</p>}
				<div className="ob-cta">
					{enabled ? (
						<>
							<span className="ob-enabled">
								<Check />
								{copy.feature.on}
							</span>
							<button type="button" className="ob-link" disabled={saving} onClick={() => toggle(false)}>
								{copy.feature.turnOff}
							</button>
						</>
					) : (
						<button type="button" className="button" disabled={saving} onClick={() => toggle(true)}>
							{copy.feature.turnOn}
						</button>
					)}
					{!enabled && turnsOnRequired && required && (
						<span className="ob-already">{copy.feature.alsoTurnsOn(copy.features[required.id].title)}</span>
					)}
				</div>
				{failed && (
					<p className="ob-error" role="alert">
						{copy.feature.error}
					</p>
				)}
			</div>
			<div className="ob-stage">
				<SceneSlot scene={scenes[feature.id]} />
			</div>
		</>
	);
}

type ConfirmDialogProps = {
	confirmation: WelcomeConfirmation;
	saving: boolean;
	failed: boolean;
	onCancel: () => void;
	onConfirm: () => void;
};

function ConfirmDialog({ confirmation, saving, failed, onCancel, onConfirm }: ConfirmDialogProps) {
	const confirmRef = useRef<HTMLButtonElement>(null);

	useEffect(() => confirmRef.current?.focus(), []);

	return (
		<div className="ob-modal-backdrop">
			<button
				type="button"
				className="ob-modal-scrim"
				tabIndex={-1}
				aria-label={copy.feature.cancel}
				onClick={onCancel}
			/>
			<div className="ob-modal" role="alertdialog" aria-modal="true" aria-labelledby="ob-modal-title">
				<h3 id="ob-modal-title">{confirmation.confirmationTitle}</h3>
				<div className="ob-modal-body">
					{confirmation.confirmationMessage && <p>{confirmation.confirmationMessage}</p>}
					{confirmation.confirmationFacts?.length ? (
						<dl className="ob-modal-facts">
							{confirmation.confirmationFacts.map((fact) => (
								<Fragment key={fact.term}>
									<dt>{fact.term}</dt>
									<dd>{fact.detail}</dd>
								</Fragment>
							))}
						</dl>
					) : null}
					{confirmation.confirmationNote && <p className="ob-modal-note">{confirmation.confirmationNote}</p>}
				</div>
				{failed && (
					<p className="ob-error" role="alert">
						{copy.feature.error}
					</p>
				)}
				<div className="ob-modal-actions">
					<button type="button" className="button button-ghost" onClick={onCancel}>
						{copy.feature.cancel}
					</button>
					<button type="button" className="button" ref={confirmRef} disabled={saving} onClick={onConfirm}>
						{confirmation.confirmText ?? copy.feature.turnOn}
					</button>
				</div>
			</div>
		</div>
	);
}

function DoneSlide({ state, onGoTo }: { state: WelcomeFeatureState; onGoTo: (index: number) => void }) {
	return (
		<>
			<div className="ob-copy">
				<span className="ob-index">{copy.done.kicker}</span>
				<h1>
					<Accented text={copy.done.title} />
				</h1>
				<p className="section-lede">{copy.done.lede}</p>
			</div>
			<ul className="ob-summary">
				{features.map((feature, index) => {
					const on = state[feature.id] === true;
					return (
						<li key={feature.id} className={on ? "is-on" : undefined}>
							<span className="ob-summary-dot" aria-hidden="true" />
							<span>{copy.features[feature.id].title}</span>
							<span className="ob-summary-state">{on ? copy.done.on : copy.done.off}</span>
							<button type="button" className="ob-link" onClick={() => onGoTo(index + 1)}>
								{copy.done.change}
							</button>
						</li>
					);
				})}
			</ul>
			<ExitActions />
		</>
	);
}

function App() {
	const [current, setCurrent] = useState(0);
	const [back, setBack] = useState(false);
	const [state, setState] = useState<WelcomeFeatureState>({});
	const [pending, setPending] = useState<{ chain: WelcomeFeature[]; confirmation: WelcomeConfirmation } | null>(null);
	const [pendingSaving, setPendingSaving] = useState(false);
	const [pendingFailed, setPendingFailed] = useState(false);
	const advanceTimer = useRef<number>();

	useEffect(() => {
		readFeatureState(features)
			.then(setState)
			.catch(() => {});
	}, []);

	const goTo = (index: number) => {
		window.clearTimeout(advanceTimer.current);
		const next = Math.max(0, Math.min(TOTAL - 1, index));
		setBack(next < current);
		setCurrent(next);
	};
	const goBy = (delta: number) => goTo(current + delta);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (pending) {
				if (event.key === "Escape") setPending(null);
				return;
			}
			if (event.target instanceof HTMLElement && event.target.closest("input, textarea")) return;
			if (event.key === "ArrowRight") goBy(1);
			if (event.key === "ArrowLeft") goBy(-1);
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	});

	const apply = async (chain: WelcomeFeature[], value: boolean) => {
		try {
			for (const item of chain) await writeFeature(item, value);
		} catch {
			return false;
		}
		setState((previous) => ({ ...previous, ...Object.fromEntries(chain.map((item) => [item.id, value])) }));
		if (value) advanceTimer.current = window.setTimeout(() => goBy(1), ADVANCE_AFTER_ENABLE_MS);
		return true;
	};

	const toggle = async (feature: WelcomeFeature, value: boolean) => {
		if (!value) return apply([feature], false);
		const required = requiredFeature(feature);
		const chain = required && state[required.id] !== true ? [required, feature] : [feature];
		const confirmation = chain.find((item) => item.confirmation && state[item.id] !== true)?.confirmation;
		if (!confirmation) return apply(chain, true);
		setPendingFailed(false);
		setPending({ chain, confirmation });
		return true;
	};

	const confirmPending = async () => {
		if (!pending) return;
		setPendingSaving(true);
		const saved = await apply(pending.chain, true);
		setPendingSaving(false);
		if (saved) setPending(null);
		else setPendingFailed(true);
	};

	const feature = features[current - 1];
	const isDone = current === TOTAL - 1;
	const centered = current === 0 || isDone;

	return (
		<div className="ob">
			<div className="ob-glow" aria-hidden="true" />
			<header className="ob-head">
				<span className="brand">
					<img className="logo" src={LOGO} width={28} height={28} alt="" />
					<span>Enhancer</span>
				</span>
				<span className="ob-step" aria-live="polite">
					{copy.step(current + 1, TOTAL)}
				</span>
				{!isDone && (
					<button type="button" className="ob-skip" onClick={() => goTo(TOTAL - 1)}>
						{copy.skip}
					</button>
				)}
			</header>

			<main className="ob-main">
				<section
					key={current}
					className={`ob-slide${centered ? " ob-slide-center" : ""}${back ? " is-back" : ""}`}
					aria-label={slideTitle(current)}
				>
					{current === 0 && <IntroSlide onStart={() => goBy(1)} />}
					{feature && <FeatureSlide feature={feature} index={current} state={state} onToggle={toggle} />}
					{isDone && <DoneSlide state={state} onGoTo={goTo} />}
				</section>
			</main>

			<nav className="ob-foot" aria-label="Onboarding">
				<button
					type="button"
					className="ob-arrow"
					aria-label={copy.previous}
					disabled={current === 0}
					onClick={() => goBy(-1)}
				>
					<Arrow direction="left" />
				</button>
				<ol className="ob-dots">
					{Array.from({ length: TOTAL }, (_, index) => {
						const dotFeature = features[index - 1];
						const classes = [index === current && "is-active", dotFeature && state[dotFeature.id] && "is-on"]
							.filter(Boolean)
							.join(" ");
						return (
							<li key={index}>
								<button
									type="button"
									className={classes || undefined}
									aria-label={copy.goTo(slideTitle(index))}
									aria-current={index === current ? "step" : undefined}
									onClick={() => goTo(index)}
								/>
							</li>
						);
					})}
				</ol>
				<button
					type="button"
					className="ob-arrow ob-arrow-next"
					aria-label={copy.next}
					disabled={isDone}
					onClick={() => goBy(1)}
				>
					<Arrow direction="right" />
				</button>
			</nav>

			{pending && (
				<ConfirmDialog
					confirmation={pending.confirmation}
					saving={pendingSaving}
					failed={pendingFailed}
					onCancel={() => setPending(null)}
					onConfirm={confirmPending}
				/>
			)}
		</div>
	);
}

document.documentElement.lang = locale;
document.title = copy.title;
render(<App />, document.getElementById("app")!);
