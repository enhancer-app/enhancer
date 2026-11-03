import type { GlobalSettings } from "$types/shared/settings/global-settings.types.ts";
import type { CredentialScope, CredentialScopeDefinition } from "$types/shared/worker/credentials-worker.types.ts";

export const CREDENTIAL_SCOPES: Record<CredentialScope, CredentialScopeDefinition> = {
	"kick:follows": {
		platform: "kick",
		allowedRequests: [
			/^https:\/\/kick\.com\/api\/v2\/channels\/followed(\?cursor=\d+)?$/,
			/^https:\/\/kick\.com\/api\/v1\/user\/livestreams$/,
			/^https:\/\/kick\.com\/api\/v1\/user$/,
		],
	},
};

export function getRequiredScopes(settings: GlobalSettings): CredentialScope[] {
	const scopes: CredentialScope[] = [];
	if (settings.crossPlatformFollowsSyncEnabled) scopes.push("kick:follows");
	return scopes;
}

export function isAllowedCredentialRequest(scope: CredentialScope, url: string): boolean {
	return CREDENTIAL_SCOPES[scope].allowedRequests.some((pattern) => pattern.test(url));
}
