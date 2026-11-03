import { CREDENTIAL_SCOPES, isAllowedCredentialRequest } from "$shared/worker/credentials/credential.scopes.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type {
	CredentialFetchResult,
	CredentialSaveResult,
	CredentialScope,
	CredentialStore,
	StoredCredential,
} from "$types/shared/worker/credentials-worker.types.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const REQUEST_TIMEOUT_MS = 15_000;

export class CredentialVault {
	private key: Promise<CryptoKey> | null = null;

	constructor(private readonly store: CredentialStore) {}

	async syncGrants(scopes: CredentialScope[]): Promise<void> {
		const wanted = new Set(scopes);
		const grants = await this.store.getGrants();
		const granted = new Set(grants.map((grant) => grant.scope));

		for (const grant of grants) {
			if (!wanted.has(grant.scope)) await this.store.deleteGrant(grant.scope);
		}
		for (const scope of wanted) {
			if (!granted.has(scope)) await this.store.putGrant({ scope, grantedAt: Date.now() });
		}

		const platformsInUse = new Set([...wanted].map((scope) => CREDENTIAL_SCOPES[scope].platform));
		for (const platform of ["twitch", "kick"] as const) {
			if (!platformsInUse.has(platform)) await this.store.deleteCredential(platform);
		}
	}

	async save(platform: PlatformType, token: string | null): Promise<CredentialSaveResult> {
		if (!token) {
			const existing = await this.store.getCredential(platform);
			if (!existing) return "unchanged";
			await this.store.deleteCredential(platform);
			return "removed";
		}
		if (!(await this.isPlatformGranted(platform))) return "not-granted";

		const existing = await this.store.getCredential(platform);
		if (existing && (await this.decrypt(existing).catch(() => null)) === token) return "unchanged";

		await this.store.putCredential({
			platform,
			...(await this.encrypt(token)),
			accountId: existing?.accountId ?? null,
			savedAt: Date.now(),
		});
		return "saved";
	}

	async hasCredential(platform: PlatformType): Promise<boolean> {
		return !!(await this.store.getCredential(platform));
	}

	async getAccountId(platform: PlatformType): Promise<string | null> {
		return (await this.store.getCredential(platform))?.accountId ?? null;
	}

	async setAccountId(platform: PlatformType, accountId: string): Promise<void> {
		const credential = await this.store.getCredential(platform);
		if (credential) await this.store.putCredential({ ...credential, accountId });
	}

	async fetch(scope: CredentialScope, url: string): Promise<CredentialFetchResult> {
		if (!isAllowedCredentialRequest(scope, url)) throw new Error(`Request not allowed for scope ${scope}`);

		const { platform } = CREDENTIAL_SCOPES[scope];
		const grants = await this.store.getGrants();
		if (!grants.some((grant) => grant.scope === scope)) return { ok: false, reason: "missing" };

		const credential = await this.store.getCredential(platform);
		const token = credential ? await this.decrypt(credential).catch(() => null) : null;
		if (!token) return { ok: false, reason: "missing" };

		let response: Response;
		try {
			response = await fetch(url, {
				credentials: "omit",
				headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
			});
		} catch {
			return { ok: false, reason: "failed" };
		}

		if (isRejected(response)) {
			await this.store.deleteCredential(platform);
			return { ok: false, reason: "rejected" };
		}
		return { ok: true, response };
	}

	private async isPlatformGranted(platform: PlatformType): Promise<boolean> {
		const grants = await this.store.getGrants();
		return grants.some((grant) => CREDENTIAL_SCOPES[grant.scope]?.platform === platform);
	}

	private async encrypt(token: string): Promise<Pick<StoredCredential, "iv" | "data">> {
		const iv = crypto.getRandomValues(new Uint8Array(12));
		const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await this.getKey(), encoder.encode(token));
		return { iv, data };
	}

	private async decrypt(credential: StoredCredential): Promise<string> {
		const data = await crypto.subtle.decrypt(
			{ name: "AES-GCM", iv: credential.iv },
			await this.getKey(),
			credential.data,
		);
		return decoder.decode(data);
	}

	private getKey(): Promise<CryptoKey> {
		this.key ??= this.loadKey().catch((error) => {
			this.key = null;
			throw error;
		});
		return this.key;
	}

	private async loadKey(): Promise<CryptoKey> {
		const existing = await this.store.getKey();
		if (existing) return existing;
		const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
		await this.store.putKey(key);
		return key;
	}
}

// Cloudflare challenges also answer 403, but with HTML; only the platform's own JSON 401/403 rejects the token.
function isRejected(response: Response): boolean {
	if (response.status !== 401 && response.status !== 403) return false;
	if (response.headers.has("cf-mitigated")) return false;
	return response.headers.get("content-type")?.includes("application/json") ?? false;
}
