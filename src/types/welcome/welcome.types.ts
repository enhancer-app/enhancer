import type { GlobalSettings } from "$types/shared/settings/global-settings.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";

export type WelcomePlatform = "Twitch" | "Kick";

export type WelcomeFeatureId = "follows" | "home" | "attachments" | "latency" | "emotebar" | "grouping";

export type WelcomeSetting =
	| { scope: "global"; key: keyof Pick<GlobalSettings, "crossPlatformFollowsSyncEnabled" | "followsHomeEnabled"> }
	| {
			scope: "platform";
			key: "chatImagesEnabled" | "streamLatencyReducerEnabled" | "emoteBarEnabled" | "chatMessageGroupingEnabled";
			platforms: PlatformType[];
	  };

export type WelcomeFeature = {
	id: WelcomeFeatureId;
	platforms: WelcomePlatform[];
	setting: WelcomeSetting;
	requires?: WelcomeFeatureId;
};

export type WelcomeFeatureState = Partial<Record<WelcomeFeatureId, boolean>>;

export type Accent = [string, string];

export type WelcomeFeatureCopy = {
	title: string;
	description: string;
	note?: string;
	warning?: boolean;
};

export type WelcomeCopy = {
	title: string;
	skip: string;
	step: (current: number, total: number) => string;
	previous: string;
	next: string;
	goTo: (title: string) => string;
	intro: {
		title: Accent;
		lede: string;
		start: string;
		notInterested: string;
		openTwitch: string;
		openKick: string;
		close: string;
	};
	feature: {
		turnOn: string;
		on: string;
		turnOff: string;
		requires: (title: string) => string;
		showRequired: string;
		error: string;
		available: string;
	};
	features: Record<WelcomeFeatureId, WelcomeFeatureCopy>;
	done: {
		kicker: string;
		title: Accent;
		lede: string;
		on: string;
		off: string;
		change: string;
	};
};
