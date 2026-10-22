import { EnhancerAccountComponent } from "$shared/components/enhancer-account/enhancer-account.component.tsx";
import { canUseDeveloperSettings, isPreviewBuild } from "$shared/enhancer-environment.ts";
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
	];
}

export function createDeveloperSettings<T>(categoryId: string): SettingDefinition<T>[] {
	if (!canUseDeveloperSettings()) return [];
	return [
		{
			id: "developerSettingsEnabled",
			title: "Developer Settings",
			description: "Settings for testing Enhancer itself. If you do not know what they do, leave them off.",
			type: "toggle",
			categoryId,
		},
		{
			id: "apiEnvironment",
			title: "Enhancer API",
			description:
				"Which Enhancer API badges, nicknames and the account use. If you do not know what this does, do not change it. Switching reloads your Twitch and Kick tabs.",
			type: "select",
			categoryId,
			dependsOn: { key: "developerSettingsEnabled" },
			options: [
				{ value: "production", label: "Production (api.enhancer.at)" },
				{ value: "test", label: "Test (test-api.enhancer.at)" },
			],
		},
	];
}
