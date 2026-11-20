import "./welcome.css";
import "./scenes/scenes.css";

import type { Accent, WelcomeFeature, WelcomePlatform } from "$types/welcome/welcome.types.ts";
import { render } from "preact";
import type { ComponentType, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { SceneProps } from "./scenes/scene.tsx";
import { TwAccountScene } from "./scenes/tw-account.tsx";
import { TwAttachmentsScene } from "./scenes/tw-attachments.tsx";
import { TwChattersScene } from "./scenes/tw-chatters.tsx";
import { TwEmoteBarScene } from "./scenes/tw-emotebar.tsx";
import { TwHeroScene } from "./scenes/tw-hero.tsx";
import { TwHomeScene } from "./scenes/tw-home.tsx";
import { TwLatencyScene } from "./scenes/tw-latency.tsx";
import { TwitchFollowsScene } from "./scenes/twitch-follows.tsx";
import { locale } from "./scenes/locale.ts";
import { copy, features, links, supporterBadge } from "./welcome.content.ts";

type SceneComponent = ComponentType<SceneProps>;

const LOGO = "/assets/enhancer/logo-128.png";

const scenes: Record<WelcomeFeature["id"], SceneComponent> = {
	follows: TwitchFollowsScene,
	home: TwHomeScene,
	chatters: TwChattersScene,
	attachments: TwAttachmentsScene,
	latency: TwLatencyScene,
	emotebar: TwEmoteBarScene,
};

const socials: { name: string; href: string; icon: ReactNode }[] = [
	{
		name: "GitHub",
		href: links.github,
		icon: (
			<path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.2-3.4-1.2-.5-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.4 1.1 2.9.8.1-.7.4-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0 0 12 2z" />
		),
	},
	{
		name: "Discord",
		href: links.discord,
		icon: (
			<path d="M19.3 5.3A16.5 16.5 0 0 0 15.2 4l-.5 1.1a15.3 15.3 0 0 0-5.4 0L8.8 4a16.5 16.5 0 0 0-4.1 1.3C2.1 9.2 1.4 13 1.7 16.7a16.6 16.6 0 0 0 5 2.5l1.1-1.7c-.6-.2-1.2-.5-1.7-.9l.4-.3a11.9 11.9 0 0 0 11 0l.4.3c-.5.4-1.1.7-1.7.9l1.1 1.7a16.6 16.6 0 0 0 5-2.5c.4-4.3-.7-8.1-3-11.4zM8.7 14.5c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z" />
		),
	},
	{
		name: "X (Twitter)",
		href: links.twitter,
		icon: (
			<path d="M17.8 3h3.1l-6.8 7.7 8 10.3h-6.2l-4.9-6.3L5.4 21H2.3l7.2-8.2L1.9 3h6.4l4.4 5.8zm-1.1 16.2h1.7L7.4 4.7H5.6z" />
		),
	},
];

function useInView<T extends Element>() {
	const ref = useRef<T>(null);
	const [inView, setInView] = useState(false);

	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		const observer = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? false));
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	return [ref, inView] as const;
}

function SceneSlot({
	scene: Scene,
	active = true,
	fit = false,
}: {
	scene: SceneComponent;
	active?: boolean;
	fit?: boolean;
}) {
	const [ref, inView] = useInView<HTMLDivElement>();
	return (
		<div ref={ref} className="scene-slot">
			<Scene playing={inView && active} fit={fit} />
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

function Logo({ size = 28 }: { size?: number }) {
	return <img className="logo" src={LOGO} width={size} height={size} alt="" />;
}

function Nav() {
	const [scrolled, setScrolled] = useState(false);
	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 12);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	return (
		<header className={`nav${scrolled ? " nav-scrolled" : ""}`}>
			<div className="nav-inner">
				<a className="brand" href="#top">
					<Logo />
					<span>Enhancer</span>
				</a>
				<nav aria-label="Main">
					<a href={links.docs}>{copy.nav.docs}</a>
				</nav>
				<div className="nav-icons">
					{socials.map((social) => (
						<a
							key={social.name}
							className="icon-button"
							href={social.href}
							aria-label={social.name}
							title={social.name}
						>
							<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
								{social.icon}
							</svg>
						</a>
					))}
				</div>
				<a className="button button-small" href={links.twitch}>
					{copy.hero.openTwitch}
				</a>
			</div>
		</header>
	);
}

function PlatformButtons() {
	return (
		<div className="actions">
			<a className="button" href={links.twitch}>
				{copy.hero.openTwitch}
			</a>
			<a className="button button-ghost platform-button-kick" href={links.kick}>
				{copy.hero.openKick}
			</a>
		</div>
	);
}

function Hero() {
	return (
		<section className="hero" id="top">
			<div className="hero-glow" aria-hidden="true" />
			<div className="container hero-copy">
				<p className="hero-badge">
					<span className="hero-badge-dot" aria-hidden="true" />
					<span>
						<strong>Enhancer {__version__}</strong> {copy.hero.badge}
					</span>
				</p>
				<h1>
					<Accented text={copy.hero.title} />
				</h1>
				<p className="lede">{copy.hero.lede}</p>
				<PlatformButtons />
			</div>
			<div className="container hero-visual">
				<SceneSlot scene={TwHeroScene} />
			</div>
		</section>
	);
}

function PlatformTags({ platforms }: { platforms: WelcomePlatform[] }) {
	return (
		<ul className="platforms" aria-label={copy.features.available}>
			{platforms.map((platform) => (
				<li key={platform} data-platform={platform.toLowerCase()}>
					{platform}
				</li>
			))}
		</ul>
	);
}

function FeatureStory() {
	const [active, setActive] = useState(0);
	const stepRefs = useRef<(HTMLElement | null)[]>([]);

	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) continue;
					const index = Number((entry.target as HTMLElement).dataset.index);
					if (!Number.isNaN(index)) setActive(index);
				}
			},
			{ rootMargin: "-45% 0px -45% 0px" },
		);
		for (const step of stepRefs.current) if (step) observer.observe(step);
		return () => observer.disconnect();
	}, []);

	return (
		<section className="features" id="features">
			<div className="container">
				<div className="section-head">
					<p className="kicker">{copy.features.kicker}</p>
					<h2>
						<Accented text={copy.features.title} />
					</h2>
					<p className="section-lede">{copy.features.lede}</p>
				</div>

				<div className="story">
					<div className="story-steps">
						{features.map((feature, index) => (
							<article
								key={feature.id}
								ref={(element) => {
									stepRefs.current[index] = element;
								}}
								data-index={index}
								className={`story-step${index === active ? " is-active" : ""}`}
								aria-labelledby={`feature-${feature.id}`}
							>
								<div id={`feature-${feature.id}`} className="story-text">
									<div className="feature-meta">
										<span className="feature-index">{String(index + 1).padStart(2, "0")}</span>
									</div>
									<h3>{copy.features.items[feature.id].title}</h3>
									<p>{copy.features.items[feature.id].description}</p>
									<PlatformTags platforms={feature.platforms} />
								</div>
								<div className="story-inline">
									<SceneSlot scene={scenes[feature.id]} />
								</div>
							</article>
						))}
					</div>

					<div className="story-stage" aria-hidden="true">
						<div className="stage">
							{features.map((feature, index) => (
								<div key={feature.id} className={`stage-clip${index === active ? " is-active" : ""}`}>
									<SceneSlot scene={scenes[feature.id]} active={index === active} fit />
								</div>
							))}
						</div>
						<ol className="stage-progress">
							{features.map((feature, index) => (
								<li key={feature.id} className={index === active ? "is-active" : undefined} />
							))}
						</ol>
					</div>
				</div>
			</div>
		</section>
	);
}

function More() {
	return (
		<section className="more" aria-label="More features">
			<p className="container more-tail">
				<Accented text={copy.more} />
			</p>
		</section>
	);
}

function TopBarMock() {
	return (
		<div className="topbar-mock" aria-hidden="true">
			<span className="topbar-mock-search" />
			<span className="topbar-mock-icon" />
			<span className="topbar-mock-icon" />
			<span className="topbar-mock-enhancer">
				<img src="/assets/enhancer/logo-gray.svg" width={20} height={20} alt="" />
			</span>
			<span className="topbar-mock-avatar" />
		</div>
	);
}

function Settings() {
	return (
		<section className="settings" id="settings" aria-labelledby="settings-title">
			<div className="container settings-grid">
				<div>
					<p className="kicker">{copy.settings.kicker}</p>
					<h2 id="settings-title">
						<Accented text={copy.settings.title} />
					</h2>
					<p className="section-lede">{copy.settings.lede}</p>
					<TopBarMock />
				</div>
				<ol className="settings-steps">
					{copy.settings.steps.map((step) => (
						<li key={step.title}>
							<div>
								<strong>{step.title}</strong>
								<span>
									{step.text[0]}
									{step.text[1] !== undefined && (
										<>
											<span className="settings-logo">
												<img src="/assets/enhancer/logo-gray.svg" width={14} height={14} alt="Enhancer" />
											</span>
											{step.text[1]}
										</>
									)}
								</span>
							</div>
						</li>
					))}
				</ol>
			</div>
		</section>
	);
}

function Account() {
	return (
		<section className="account" id="account" aria-labelledby="account-title">
			<div className="container">
				<div className="account-grid">
					<div className="account-copy">
						<p className="kicker">{copy.account.kicker}</p>
						<h2 id="account-title">
							<Accented text={copy.account.title} />
						</h2>
						<p className="section-lede">{copy.account.lede}</p>
						<ul className="account-points">
							{copy.account.points.map((point) => (
								<li key={point.title}>
									<strong>{point.title}</strong>
									<span>{point.text}</span>
								</li>
							))}
						</ul>
						<div className="account-actions">
							<a className="button" href={links.account}>
								{copy.account.cta} →
							</a>
						</div>
					</div>
					<div className="account-visual">
						<SceneSlot scene={TwAccountScene} />
					</div>
				</div>
				<div className="support">
					<div className="support-copy">
						<h3>{copy.account.support.title}</h3>
						<p>{copy.account.support.text}</p>
					</div>
					<ul className="support-perks" aria-label={copy.account.support.title}>
						<li>
							<img className="support-badge" src={supporterBadge} width={28} height={28} loading="lazy" alt="" />
							{copy.account.support.perks[0]}
						</li>
						<li>
							<span className="support-glow" aria-hidden="true">
								{copy.account.support.nick}
							</span>
							{copy.account.support.perks[1]}
						</li>
						<li>
							<span className="support-font" aria-hidden="true">
								{copy.account.support.nick}
							</span>
							{copy.account.support.perks[2]}
						</li>
						<li>
							<span className="support-rename" aria-hidden="true">
								<s>user123</s> → <b>{copy.account.support.nick}</b>
							</span>
							{copy.account.support.perks[3]}
						</li>
						<li className="support-cta">
							<a href={links.support}>{copy.account.support.cta} →</a>
						</li>
					</ul>
				</div>
			</div>
		</section>
	);
}

function Principles() {
	return (
		<section className="principles" aria-label={copy.principles.label}>
			<div className="container principles-grid">
				<div>
					<h2>
						<Accented text={copy.principles.free.title} />
					</h2>
					<p>{copy.principles.free.text}</p>
				</div>
				<div>
					<h2>
						<Accented text={copy.principles.open.title} />
					</h2>
					<p>{copy.principles.open.text}</p>
					<a className="text-link" href={links.github}>
						{copy.principles.open.link}
					</a>
				</div>
				<div>
					<h2>
						<Accented text={copy.principles.privacy.title} />
					</h2>
					<p>{copy.principles.privacy.text}</p>
				</div>
			</div>
		</section>
	);
}

function Footer() {
	return (
		<footer className="footer">
			<div className="container">
				<div className="footer-about">
					<a className="brand" href="#top">
						<Logo size={26} />
						<span>Enhancer</span>
					</a>
					<p>{copy.footer.tagline}</p>
					<PlatformButtons />
				</div>
				<div className="footer-bottom">
					<span>Enhancer {__version__}</span>
					<span>{copy.footer.disclaimer}</span>
				</div>
			</div>
		</footer>
	);
}

function App() {
	return (
		<>
			<Nav />
			<main>
				<Hero />
				<FeatureStory />
				<More />
				<Settings />
				<Account />
				<Principles />
			</main>
			<Footer />
		</>
	);
}

document.documentElement.lang = locale;
document.title = copy.title;
render(<App />, document.getElementById("app")!);
