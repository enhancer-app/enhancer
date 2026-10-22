import { EnhancerAccountComponent } from "$shared/components/enhancer-account/enhancer-account.component.tsx";
import { isPreviewBuild } from "$shared/enhancer-environment.ts";
import type WorkerService from "$shared/worker/worker.service.ts";
import type { SettingCategory, SettingDefinition } from "$types/shared/components/settings.component.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";

export const ACCOUNT_CATEGORY_ID = "account";

export function createAccountCategories(order: number): SettingCategory[] {
	return isPreviewBuild() ? [{ id: ACCOUNT_CATEGORY_ID, title: "Account", order }] : [];
}

export function createAccountSettings<T>(
	workerService: WorkerService,
	platform: PlatformType,
	logoUrl: string,
): SettingDefinition<T>[] {
	if (!isPreviewBuild()) return [];
	return [
		{
			id: "enhancer-account",
			title: "Enhancer Account",
			description: "Log in to your Enhancer Account and choose which badges are shown.",
			type: "text",
			categoryId: ACCOUNT_CATEGORY_ID,
			content: () => <EnhancerAccountComponent workerService={workerService} platform={platform} logoUrl={logoUrl} />,
			hideInfo: true,
		},
		{
			id: "apiEnvironment",
			title: "Enhancer API",
			description:
				"Only in Canary and development builds. Chooses which Enhancer API badges, nicknames and the account use. Switching reloads your Twitch and Kick tabs.",
			type: "select",
			categoryId: ACCOUNT_CATEGORY_ID,
			options: [
				{ value: "production", label: "Production (api.enhancer.at)" },
				{ value: "test", label: "Test (test-api.enhancer.at)" },
			],
		},
	];
}
