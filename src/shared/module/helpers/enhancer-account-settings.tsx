import { EnhancerAccountFrame } from "$shared/components/enhancer-account/enhancer-account-frame.component.tsx";
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

export function createAccountSettings<T>(platform: PlatformType, logoUrl: string): SettingDefinition<T>[] {
	if (!isPreviewBuild()) return [];
	return [
		{
			id: "enhancer-account",
			title: "Enhancer Account",
			description: "Log in to your Enhancer Account to pick your badges and chat style.",
			type: "text",
			categoryId: ACCOUNT_CATEGORY_ID,
			content: () => <EnhancerAccountFrame platform={platform} logoUrl={logoUrl} />,
			hideInfo: true,
		},
	];
}

export function createCosmeticsLink<T>(categoryId: string): SettingDefinition<T>[] {
	if (!isPreviewBuild()) return [];
	return [
		{
			id: "cosmeticsAccountLink",
			title: "Your chat style",
			description: "Change your nickname, font, glow and badges in your Enhancer Account.",
			type: "action",
			categoryId,
			tags: ["nickname", "font", "glow", "badge", "cosmetics"],
			actionLabel: "Open Account",
			targetCategoryId: ACCOUNT_CATEGORY_ID,
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
	const toggle = (categoryId: string, section?: string): SettingDefinition<T> => ({
		id: "developerSettingsEnabled",
		title: "Developer settings",
		description: "For testing Enhancer. Leave them off if you're not sure.",
		type: "toggle",
		categoryId,
		section,
		confirmOnEnable: true,
		confirmationTitle: "Turn on developer settings?",
		confirmationMessage:
			"These settings are for Enhancer developers and testers. Only turn them on if you know what you're doing.\n\nWrong values can break badges, nicknames and your Enhancer Account. Turning developer settings off switches Enhancer back to the production API.",
		confirmText: "I know what I'm doing",
		confirmTone: "danger",
	});
	return [
		toggle(aboutCategoryId, "Advanced"),
		toggle(DEVELOPER_CATEGORY_ID),
		{
			id: "apiEnvironment",
			title: "Enhancer API",
			description: "Which API badges, nicknames and the account use.",
			hint: "Switching reloads your Twitch and Kick tabs.",
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
