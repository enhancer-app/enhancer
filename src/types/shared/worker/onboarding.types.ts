export type WelcomeRecord = {
	shownAt: number;
	version: string;
};

export type OnboardingStorageArea = {
	get(key: string): Promise<Record<string, unknown>>;
	set(items: Record<string, unknown>): Promise<void>;
};

export type OnboardingDependencies = {
	sync: OnboardingStorageArea;
	local: OnboardingStorageArea;
	openWelcomePage: () => Promise<unknown>;
	version: string;
	now?: () => number;
};
