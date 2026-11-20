import { afterEach, expect, test } from "bun:test";
import { CredentialVault } from "$shared/worker/credentials/credential.vault.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type {
	CredentialGrant,
	CredentialScope,
	CredentialStore,
	StoredCredential,
} from "$types/shared/worker/credentials-worker.types.ts";

const TOKEN = "123|secret-session-token";
const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

class MemoryCredentialStore implements CredentialStore {
	credentials = new Map<PlatformType, StoredCredential>();
	grants = new Map<CredentialScope, CredentialGrant>();
	key: CryptoKey | undefined;

	async getCredential(platform: PlatformType) {
		return this.credentials.get(platform);
	}
	async putCredential(credential: StoredCredential) {
		this.credentials.set(credential.platform, credential);
	}
	async deleteCredential(platform: PlatformType) {
		this.credentials.delete(platform);
	}
	async getGrants() {
		return [...this.grants.values()];
	}
	async putGrant(grant: CredentialGrant) {
		this.grants.set(grant.scope, grant);
	}
	async deleteGrant(scope: CredentialScope) {
		this.grants.delete(scope);
	}
	async getKey() {
		return this.key;
	}
	async putKey(key: CryptoKey) {
		this.key = key;
	}
}

function mockFetch(response: () => Response) {
	const calls: { url: string; init?: RequestInit }[] = [];
	globalThis.fetch = (async (url: string, init?: RequestInit) => {
		calls.push({ url, init });
		return response();
	}) as unknown as typeof fetch;
	return calls;
}

async function createVault(granted = true) {
	const store = new MemoryCredentialStore();
	const vault = new CredentialVault(store);
	if (granted) await vault.syncGrants(["kick:follows"]);
	return { store, vault };
}

test("deletes the saved login once no enabled feature needs it", async () => {
	const { vault } = await createVault();
	expect(await vault.save("kick", TOKEN)).toBe("saved");

	await vault.syncGrants(["kick:follows"]);
	expect(await vault.hasCredential("kick")).toBe(true);

	await vault.syncGrants([]);
	expect(await vault.hasCredential("kick")).toBe(false);
});

test("refuses to save a login that no feature was granted", async () => {
	const { vault } = await createVault(false);
	expect(await vault.save("kick", TOKEN)).toBe("not-granted");
	expect(await vault.hasCredential("kick")).toBe(false);
});

test("removes the saved login when the site reports a logout", async () => {
	const { vault } = await createVault();
	await vault.save("kick", TOKEN);
	expect(await vault.save("kick", null)).toBe("removed");
	expect(await vault.hasCredential("kick")).toBe(false);
});

test("stores the login encrypted and only sends it to allowed requests", async () => {
	const { store, vault } = await createVault();
	await vault.save("kick", TOKEN);
	expect(await vault.save("kick", TOKEN)).toBe("unchanged");

	const stored = new TextDecoder().decode(store.credentials.get("kick")!.data);
	expect(stored).not.toContain("secret-session-token");

	const calls = mockFetch(() => Response.json([]));
	const result = await vault.fetch("kick:follows", "https://kick.com/api/v1/user/livestreams");
	expect(result.ok).toBe(true);
	expect(calls[0].init?.headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` });
	expect(calls[0].init?.credentials).toBe("omit");

	await expect(vault.fetch("kick:follows", "https://evil.example/api/v1/user/livestreams")).rejects.toThrow();
	await expect(vault.fetch("kick:follows", "https://kick.com/api/v2/channels/xqc/follow")).rejects.toThrow();
	expect(calls.length).toBe(1);
});

test("drops the login only when Kick itself rejects it", async () => {
	const { vault } = await createVault();
	await vault.save("kick", TOKEN);

	mockFetch(() => new Response("<html>", { status: 403, headers: { "cf-mitigated": "challenge" } }));
	expect(await vault.fetch("kick:follows", "https://kick.com/api/v1/user")).toMatchObject({ ok: true });
	expect(await vault.hasCredential("kick")).toBe(true);

	mockFetch(() => Response.json({ message: "Unauthenticated." }, { status: 401 }));
	expect(await vault.fetch("kick:follows", "https://kick.com/api/v1/user")).toEqual({
		ok: false,
		reason: "rejected",
	});
	expect(await vault.hasCredential("kick")).toBe(false);
});
