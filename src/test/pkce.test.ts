import { expect, test } from "bun:test";
import {
	base64UrlDecode,
	base64UrlEncode,
	createCodeChallenge,
	createPkceChallenge,
	createRandomString,
	decodeJwtClaims,
	parseAuthorizationCallback,
} from "$shared/worker/enhancer-account/pkce.ts";

function encodeToken(payload: Record<string, unknown>): string {
	const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ alg: "RS256" })));
	const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
	return `${header}.${body}.signature`;
}

test("base64url helpers round-trip unicode", () => {
	const bytes = new TextEncoder().encode("zażółć gęślą jaźń ✓");
	const encoded = base64UrlEncode(bytes);
	expect(encoded).not.toContain("+");
	expect(encoded).not.toContain("/");
	expect(encoded).not.toContain("=");
	expect(base64UrlDecode(encoded)).toBe("zażółć gęślą jaźń ✓");
});

test("creates S256 challenge for the RFC 7636 verifier", async () => {
	const challenge = await createCodeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
	expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
	expect(challenge).toMatch(/^[A-Za-z0-9\-_]{43}$/);
});

test("creates self-consistent PKCE challenge", async () => {
	const pkce = await createPkceChallenge();
	expect(pkce.method).toBe("S256");
	expect(pkce.verifier.length).toBeGreaterThan(0);
	expect(await createCodeChallenge(pkce.verifier)).toBe(pkce.challenge);
});

test("creates distinct random strings", () => {
	const first = createRandomString(16);
	const second = createRandomString(16);
	expect(first.length).toBeGreaterThan(0);
	expect(second).not.toBe(first);
	expect(first).toMatch(/^[A-Za-z0-9\-_]+$/);
});

test("parses successful authorization callback", () => {
	const result = parseAuthorizationCallback("https://example.invalid/?code=abc&state=xyz", "xyz");
	expect(result).toEqual({ code: "abc" });
});

test("rejects authorization callback with mismatched state", () => {
	const result = parseAuthorizationCallback("https://example.invalid/?code=abc&state=other", "xyz");
	expect(result).toEqual({ error: "Authorization state mismatch", cancelled: false });
});

test("treats access_denied as cancelled login", () => {
	const result = parseAuthorizationCallback(
		"https://example.invalid/?error=access_denied&error_description=denied&state=xyz",
		"xyz",
	);
	expect(result).toEqual({ error: "denied", cancelled: true });
});

test("treats other authorization errors as failures", () => {
	const result = parseAuthorizationCallback("https://example.invalid/?error=server_error&state=xyz", "xyz");
	expect(result).toEqual({ error: "server_error", cancelled: false });
});

test("rejects callback without code or with invalid url", () => {
	expect(parseAuthorizationCallback("https://example.invalid/?state=xyz", "xyz")).toEqual({
		error: "Authorization code is missing",
		cancelled: false,
	});
	expect(parseAuthorizationCallback("not a url", "xyz")).toEqual({
		error: "Invalid authorization response",
		cancelled: false,
	});
});

test("decodes JWT claims", () => {
	const claims = decodeJwtClaims(encodeToken({ sub: "123", nonce: "n", preferred_username: "user" }));
	expect(claims?.sub).toBe("123");
	expect(claims?.nonce).toBe("n");
	expect(claims?.preferred_username).toBe("user");
});

test("returns null for malformed tokens", () => {
	expect(decodeJwtClaims("not-a-token")).toBeNull();
	expect(decodeJwtClaims("a.b.c")).toBeNull();
});
