import { EnhancerAccountComponent } from "$shared/components/enhancer-account/enhancer-account.component.tsx";
import { EnhancerAccountIdentity } from "$shared/components/enhancer-account/enhancer-account-identity.component.tsx";
import { canUseDeveloperSettings, isPreviewBuild } from "$shared/enhancer-environment.ts";
import type WorkerService from "$shared/worker/worker.service.ts";
import type {
	SettingCategory,
	SettingDefinition,
	SettingsIdentityRenderer,
} from "$types/shared/components/settings.component.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { GlobalSettings } from "$types/shared/settings/global-settings.types.ts";

export const ACCOUNT_CATEGORY_ID = "account";
export const DEVELOPER_CATEGORY_ID = "developer";

export function createAccountCategories(order: number): SettingCategory[] {
	return isPreviewBuild() ? [{ id: ACCOUNT_CATEGORY_ID, title: "Account", order, hiddenInNav: true, bare: true }] : [];
}

export function createAccountIdentity(
	workerService: WorkerService,
	platform: PlatformType,
): SettingsIdentityRenderer | undefined {
	if (!isPreviewBuild()) return undefined;
	return (props) => <EnhancerAccountIdentity {...props} workerService={workerService} platform={platform} />;
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

export function createDeveloperCategories(order: number): SettingCategory<Partial<GlobalSettings>>[] {
	if (!canUseDeveloperSettings()) return [];
	return [
		{
			id: DEVELOPER_CATEGORY_ID,
			title: "Developer",
			order,
			placement: "utility",
			isVisible: (settings) => settings.developerSettingsEnabled === true,
		},
	];
}

export function createDeveloperSettings<T>(aboutCategoryId: string): SettingDefinition<T>[] {
	if (!canUseDeveloperSettings()) return [];
	const toggle = (categoryId: string): SettingDefinition<T> => ({
		id: "developerSettingsEnabled",
		title: "Developer settings",
		description: "Settings for testing Enhancer itself. If you do not know what they do, leave them off.",
		type: "toggle",
		categoryId,
		confirmOnEnable: true,
		confirmationTitle: "Turn on developer settings?",
		confirmationMessage:
			"These settings are for Enhancer developers and testers. Only turn them on if you know what you're doing.\n\nWrong values can break badges, nicknames and your Enhancer Account. Turning developer settings off switches Enhancer back to the production API.",
		confirmText: "I know what I'm doing",
		confirmTone: "danger",
	});
	return [
		toggle(aboutCategoryId),
		toggle(DEVELOPER_CATEGORY_ID),
		{
			id: "apiEnvironment",
			title: "Enhancer API",
			description:
				"Which Enhancer API badges, nicknames and the account use. If you do not know what this does, do not change it. Switching reloads your Twitch and Kick tabs.",
			type: "select",
			categoryId: DEVELOPER_CATEGORY_ID,
			dependsOn: { key: "developerSettingsEnabled" },
			options: [
				{ value: "production", label: "Production (api.enhancer.at)" },
				{ value: "test", label: "Test (test-api.enhancer.at)" },
			],
		},
	];
}
