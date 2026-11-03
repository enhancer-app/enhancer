import type { PlatformType } from "$types/shared/platform.types.ts";

export type CredentialScope = "kick:follows";

export type CredentialScopeDefinition = {
	platform: PlatformType;
	allowedRequests: RegExp[];
};

export type StoredCredential = {
	platform: PlatformType;
	iv: Uint8Array<ArrayBuffer>;
	data: ArrayBuffer;
	accountId: string | null;
	savedAt: number;
};

export type CredentialGrant = {
	scope: CredentialScope;
	grantedAt: number;
};

export interface CredentialStore {
	getCredential(platform: PlatformType): Promise<StoredCredential | undefined>;
	putCredential(credential: StoredCredential): Promise<void>;
	deleteCredential(platform: PlatformType): Promise<void>;
	getGrants(): Promise<CredentialGrant[]>;
	putGrant(grant: CredentialGrant): Promise<void>;
	deleteGrant(scope: CredentialScope): Promise<void>;
	getKey(): Promise<CryptoKey | undefined>;
	putKey(key: CryptoKey): Promise<void>;
}

export type CredentialSaveResult = "saved" | "unchanged" | "removed" | "not-granted";

export type CredentialFetchResult =
	| { ok: true; response: Response }
	| { ok: false; reason: "missing" | "rejected" | "failed" };
