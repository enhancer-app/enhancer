import type { ExtensionChannel, ExtensionEnvironment } from "$types/shared/extension.types.ts";
import type { EnhancerApiEnvironment, EnhancerEndpoints } from "$types/shared/enhancer-environment.types.ts";
import type { GlobalSettings } from "$types/shared/settings/global-settings.types.ts";

export const ENHANCER_API_ENVIRONMENTS: readonly EnhancerApiEnvironment[] = ["production", "test"];

export const ENHANCER_ENDPOINTS: Record<EnhancerApiEnvironment, EnhancerEndpoints> = {
	production: {
		api: "https://api.enhancer.at",
		websocket: "wss://api.enhancer.at/v1/ws",
		issuer: "https://auth.enhancer.at/realms/enhancer",
		dashboard: "https://dashboard.enhancer.at",
	},
	test: {
		api: "https://test-api.enhancer.at",
		websocket: "wss://test-api.enhancer.at/v1/ws",
		issuer: "https://auth.enhancer.at/realms/enhancer-test",
		dashboard: "https://test-dashboard.enhancer.at",
	},
};

export function isPreviewBuild(
	channel: ExtensionChannel = __channel__,
	environment: ExtensionEnvironment = __environment__,
): boolean {
	return channel === "canary" || environment === "development";
}

export function isEnhancerApiEnvironment(value: unknown): value is EnhancerApiEnvironment {
	return (ENHANCER_API_ENVIRONMENTS as unknown[]).includes(value);
}

export function canUseDeveloperSettings(
	channel: ExtensionChannel = __channel__,
	environment: ExtensionEnvironment = __environment__,
): boolean {
	return channel === "canary" || environment === "development";
}

export function resolveApiEnvironment(
	settings: Pick<GlobalSettings, "developerSettingsEnabled" | "apiEnvironment">,
	allowed = canUseDeveloperSettings(),
): EnhancerApiEnvironment {
	const selected: unknown = settings.apiEnvironment;
	return allowed && settings.developerSettingsEnabled && isEnhancerApiEnvironment(selected) ? selected : "production";
}
