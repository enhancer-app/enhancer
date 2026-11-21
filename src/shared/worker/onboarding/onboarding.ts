import type {
	OnboardingDependencies,
	OnboardingStorageArea,
	WelcomeRecord,
} from "$types/shared/worker/onboarding.types.ts";

export const WELCOME_STORAGE_KEY = "enhancer.onboarding.welcome";

async function hasWelcomeRecord(area: OnboardingStorageArea): Promise<boolean> {
	try {
		const stored = await area.get(WELCOME_STORAGE_KEY);
		return stored[WELCOME_STORAGE_KEY] !== undefined;
	} catch {
		return false;
	}
}

export async function openWelcomeOnFirstInstall(
	reason: string,
	{ sync, local, openWelcomePage, version, now = Date.now }: OnboardingDependencies,
): Promise<boolean> {
	if (reason !== "install") return false;
	if ((await hasWelcomeRecord(sync)) || (await hasWelcomeRecord(local))) return false;

	const record: WelcomeRecord = { shownAt: now(), version };
	await Promise.allSettled([sync.set({ [WELCOME_STORAGE_KEY]: record }), local.set({ [WELCOME_STORAGE_KEY]: record })]);
	await openWelcomePage();
	return true;
}
