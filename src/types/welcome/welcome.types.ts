export type WelcomePlatform = "Twitch" | "Kick";

export type WelcomeFeatureId = "follows" | "home" | "chatters" | "attachments" | "latency" | "emotebar";

export type WelcomeFeature = {
	id: WelcomeFeatureId;
	platforms: WelcomePlatform[];
};

export type Accent = [string, string];

export type WelcomeCopy = {
	title: string;
	nav: { docs: string; settings: string };
	hero: {
		badge: string;
		title: Accent;
		lede: string;
		openTwitch: string;
		openKick: string;
	};
	features: {
		kicker: string;
		title: Accent;
		lede: string;
		available: string;
		items: Record<WelcomeFeatureId, { title: string; description: string }>;
	};
	more: Accent;
	settings: {
		kicker: string;
		title: Accent;
		lede: string;
		steps: { title: string; text: [string] | [string, string] }[];
	};
	account: {
		kicker: string;
		title: Accent;
		lede: string;
		points: { title: string; text: string }[];
		cta: string;
		support: { title: string; text: string; cta: string; perks: string[]; nick: string };
	};
	principles: {
		label: string;
		free: { title: Accent; text: string };
		open: { title: Accent; text: string; link: string };
		privacy: { title: Accent; text: string };
	};
	footer: { tagline: string; disclaimer: string };
};
