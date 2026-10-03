import { createHash, createHmac, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { createInterface } from "node:readline/promises";
import { getManifest } from "../manifest.config";

const REPO = "enhancer-app/enhancer";
const RELEASE_ENV = "release";
const ANNOUNCE_ENV = "release-announce";
const RELEASE_BRANCH = "master";
const CHROME_SCOPE = "https://www.googleapis.com/auth/chromewebstore";

const LINKS = {
	googleCredentials: "https://console.cloud.google.com/apis/credentials",
	chromeDashboard: "https://chrome.google.com/webstore/devconsole",
	amoApiKeys: "https://addons.mozilla.org/developers/addon/api/key/",
	environments: `https://github.com/${REPO}/settings/environments`,
	actionsSettings: `https://github.com/${REPO}/settings/actions`,
};

type Secrets = Record<string, string>;

type Environment = {
	protection_rules?: {
		type: string;
		wait_timer?: number;
		prevent_self_review?: boolean;
		reviewers?: { type: string; reviewer: { id: number } }[];
	}[];
};

const flags = new Set(process.argv.slice(2));

if (flags.has("--help")) {
	console.log(`Configure release environments and secrets in ${REPO}.

Usage:
  bun run release:setup-secrets            Configure environments, Chrome and Firefox secrets
  bun run release:setup-secrets --chrome   Only Chrome Web Store secrets (e.g. refresh the token)
  bun run release:setup-secrets --firefox  Only Firefox Add-ons secrets

Secrets are written to the "${RELEASE_ENV}" environment. Requires an authenticated GitHub CLI with admin access.`);
	process.exit(0);
}

function heading(title: string): void {
	console.log(`\n=== ${title} ===`);
}

async function ask(question: string): Promise<string> {
	const readline = createInterface({ input: process.stdin, output: process.stdout });
	try {
		return (await readline.question(question)).trim();
	} finally {
		readline.close();
	}
}

async function askSecret(question: string): Promise<string> {
	if (!process.stdin.isTTY || !process.stdin.setRawMode)
		throw new Error("Enter the secret in an interactive terminal.");
	process.stdout.write(question);
	return new Promise((resolve, reject) => {
		let value = "";
		const finish = () => {
			process.stdin.off("data", onData);
			process.stdin.setRawMode(false);
			process.stdin.pause();
			process.stdout.write("\n");
		};
		const onData = (data: Buffer) => {
			for (const byte of data) {
				if (byte === 13 || byte === 10) {
					finish();
					resolve(value.trim());
					return;
				}
				if (byte === 3) {
					finish();
					reject(new Error("Cancelled."));
					return;
				}
				if (byte === 8 || byte === 127) value = value.slice(0, -1);
				else if (byte >= 32 && byte <= 126) value += String.fromCharCode(byte);
			}
		};
		process.stdin.setRawMode(true);
		process.stdin.resume();
		process.stdin.on("data", onData);
	});
}

function gh(args: string[], input?: string): string {
	const result = spawnSync("gh", args, { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
	if (result.status !== 0) throw new Error(`gh ${args.slice(0, 3).join(" ")} failed: ${result.stderr.trim()}`);
	return result.stdout;
}

function api<T>(method: string, path: string, body?: object): T {
	const args = ["api", "-X", method, `repos/${REPO}/${path}`];
	if (body) args.push("--input", "-");
	const output = gh(args, body ? JSON.stringify(body) : undefined);
	return (output ? JSON.parse(output) : undefined) as T;
}

function tryApi<T>(method: string, path: string): T | undefined {
	try {
		return api<T>(method, path);
	} catch {
		return undefined;
	}
}

function allowActionsToCreatePullRequests(): void {
	const settings = api<{ default_workflow_permissions: string; can_approve_pull_request_reviews: boolean }>(
		"GET",
		"actions/permissions/workflow",
	);
	if (settings.can_approve_pull_request_reviews) {
		console.log("GitHub Actions can already create pull requests.");
		return;
	}
	api("PUT", "actions/permissions/workflow", {
		default_workflow_permissions: settings.default_workflow_permissions,
		can_approve_pull_request_reviews: true,
	});
	console.log("Allowed GitHub Actions to create pull requests.");
}

function restrictEnvironmentToReleaseBranch(name: string, requireReviewers: boolean): void {
	const rules = tryApi<Environment>("GET", `environments/${name}`)?.protection_rules ?? [];
	const reviewersRule = rules.find((rule) => rule.type === "required_reviewers");
	const waitRule = rules.find((rule) => rule.type === "wait_timer");
	api("PUT", `environments/${name}`, {
		wait_timer: waitRule?.wait_timer ?? 0,
		prevent_self_review: reviewersRule?.prevent_self_review ?? false,
		reviewers: reviewersRule?.reviewers?.map(({ type, reviewer }) => ({ type, id: reviewer.id })) ?? null,
		deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
	});

	const policies = api<{ branch_policies: { name: string }[] }>(
		"GET",
		`environments/${name}/deployment-branch-policies`,
	);
	if (!policies.branch_policies.some((policy) => policy.name === RELEASE_BRANCH)) {
		api("POST", `environments/${name}/deployment-branch-policies`, { name: RELEASE_BRANCH, type: "branch" });
	}
	console.log(`Environment "${name}" deploys only from ${RELEASE_BRANCH}.`);

	if (requireReviewers && !reviewersRule?.reviewers?.length) {
		console.warn(`Environment "${name}" has no required reviewers. Add yourself: ${LINKS.environments}`);
	}
}

function configureRepository(): void {
	heading("Repository");
	allowActionsToCreatePullRequests();
	restrictEnvironmentToReleaseBranch(RELEASE_ENV, true);
	restrictEnvironmentToReleaseBranch(ANNOUNCE_ENV, false);
}

async function getAuthorizationCode(clientId: string): Promise<{
	authorizationCode: string;
	redirectUri: string;
	codeVerifier: string;
}> {
	const state = randomBytes(32).toString("hex");
	const codeVerifier = randomBytes(32).toString("base64url");
	const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
	let settle: (code: string) => void = () => {};
	let fail: (reason: Error) => void = () => {};
	let timeout: ReturnType<typeof setTimeout> | undefined;
	const code = new Promise<string>((resolve, reject) => {
		settle = resolve;
		fail = reject;
	});
	const server = createServer((request, response) => {
		const callback = new URL(request.url ?? "/", "http://127.0.0.1");
		if (request.method !== "GET" || callback.pathname !== "/") {
			response.writeHead(404).end();
			return;
		}
		if (callback.searchParams.get("state") !== state) {
			response.writeHead(400).end("Invalid authorization state.");
			return;
		}
		const authorizationCode = callback.searchParams.get("code");
		response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
		response.end("Authorization complete. Return to the terminal.");
		if (authorizationCode) settle(authorizationCode);
		else fail(new Error("Google denied authorization or did not return a code."));
	});
	try {
		await new Promise<void>((resolve, reject) => {
			server.once("error", reject);
			server.listen(0, "127.0.0.1", resolve);
		});
		const address = server.address();
		if (!address || typeof address === "string") throw new Error("Could not determine the callback port.");
		const redirectUri = `http://127.0.0.1:${address.port}`;
		const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
		url.searchParams.set("client_id", clientId);
		url.searchParams.set("redirect_uri", redirectUri);
		url.searchParams.set("response_type", "code");
		url.searchParams.set("scope", CHROME_SCOPE);
		url.searchParams.set("access_type", "offline");
		url.searchParams.set("prompt", "consent");
		url.searchParams.set("state", state);
		url.searchParams.set("code_challenge", codeChallenge);
		url.searchParams.set("code_challenge_method", "S256");
		console.log("Open this URL in your browser, sign in with the Enhancer publisher account, and approve access:");
		console.log(url.toString());
		const authorizationCode = await Promise.race([
			code,
			new Promise<never>((_, reject) => {
				timeout = setTimeout(() => reject(new Error("Authorization timed out after 5 minutes.")), 300_000);
			}),
		]);
		return { authorizationCode, redirectUri, codeVerifier };
	} finally {
		if (timeout) clearTimeout(timeout);
		server.close();
	}
}

async function collectChromeSecrets(): Promise<Secrets> {
	heading("Chrome Web Store");
	console.log(`OAuth client (type "Desktop app", no redirect URI needed): ${LINKS.googleCredentials}`);
	const clientId = await ask("Client ID (Enter to skip Chrome): ");
	if (!clientId) return {};
	const clientSecret = await askSecret("Client secret (hidden input): ");
	if (!clientSecret) throw new Error("Client secret is required.");

	console.log(`Publisher ID (Account page) and extension ID (item page): ${LINKS.chromeDashboard}`);
	const publisherId = await ask("Publisher ID (Enter to keep current): ");
	const extensionId = await ask("Extension ID (Enter to keep current): ");
	if (Boolean(publisherId) !== Boolean(extensionId)) {
		throw new Error("Enter both the publisher ID and the extension ID, or neither.");
	}

	const { authorizationCode, redirectUri, codeVerifier } = await getAuthorizationCode(clientId);
	const response = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: clientId,
			client_secret: clientSecret,
			code: authorizationCode,
			redirect_uri: redirectUri,
			code_verifier: codeVerifier,
			grant_type: "authorization_code",
		}),
	});
	if (!response.ok) throw new Error(`Google did not exchange the code for a token (HTTP ${response.status}).`);
	const tokens: { access_token?: string; refresh_token?: string; scope?: string } = await response.json();
	if (!tokens.refresh_token || !tokens.access_token || !tokens.scope?.split(" ").includes(CHROME_SCOPE)) {
		throw new Error("Google did not return a refresh token with Chrome Web Store access.");
	}

	const secrets: Secrets = {
		CHROME_CLIENT_ID: clientId,
		CHROME_CLIENT_SECRET: clientSecret,
		CHROME_REFRESH_TOKEN: tokens.refresh_token,
	};
	if (!publisherId) return secrets;

	const item = `publishers/${encodeURIComponent(publisherId)}/items/${encodeURIComponent(extensionId)}`;
	const status = await fetch(`https://chromewebstore.googleapis.com/v2/${item}:fetchStatus`, {
		headers: { Authorization: `Bearer ${tokens.access_token}` },
	});
	if (!status.ok) {
		throw new Error(`Chrome Web Store rejected this publisher ID and extension ID (HTTP ${status.status}).`);
	}
	console.log("Verified Chrome Web Store access to the extension.");
	return { ...secrets, CHROME_PUBLISHER_ID: publisherId, CHROME_EXTENSION_ID: extensionId };
}

function createAmoJwt(issuer: string, secret: string): string {
	const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
	const issuedAt = Math.floor(Date.now() / 1000);
	const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({
		iss: issuer,
		jti: randomBytes(16).toString("hex"),
		iat: issuedAt,
		exp: issuedAt + 60,
	})}`;
	return `${unsigned}.${createHmac("sha256", secret).update(unsigned).digest("base64url")}`;
}

async function collectFirefoxSecrets(): Promise<Secrets> {
	heading("Firefox Add-ons");
	const addonId = getManifest(false).browser_specific_settings.gecko.id;
	console.log(`Add-on ID from manifest.config.ts: ${addonId}`);
	console.log(`API credentials (generating a new secret revokes the old one): ${LINKS.amoApiKeys}`);
	const issuer = await ask("JWT issuer (Enter to skip API credentials): ");
	if (!issuer) return { FIREFOX_EXTENSION_ID: addonId };
	const secret = await askSecret("JWT secret (hidden input): ");
	if (!secret) throw new Error("JWT secret is required.");

	const response = await fetch("https://addons.mozilla.org/api/v5/accounts/profile/", {
		headers: { Authorization: `JWT ${createAmoJwt(issuer, secret)}` },
	});
	if (!response.ok) throw new Error(`Firefox Add-ons rejected the API credentials (HTTP ${response.status}).`);
	const profile: { username?: string } = await response.json();
	console.log(`Verified Firefox Add-ons credentials for ${profile.username ?? "the account"}.`);
	return { FIREFOX_EXTENSION_ID: addonId, AMO_JWT_ISSUER: issuer, AMO_JWT_SECRET: secret };
}

async function removeRepositoryCopies(names: string[]): Promise<void> {
	const repoSecrets = new Set(
		(JSON.parse(gh(["secret", "list", "-R", REPO, "--json", "name"])) as { name: string }[]).map((s) => s.name),
	);
	const duplicates = names.filter((name) => repoSecrets.has(name));
	if (duplicates.length) {
		console.log(`\nRepository-level copies still exist: ${duplicates.join(", ")}`);
		const answer = await ask(`Delete them so only the "${RELEASE_ENV}" environment holds these secrets? [y/N] `);
		if (answer.toLowerCase() === "y") {
			for (const name of duplicates) gh(["secret", "delete", name, "-R", REPO]);
			console.log(`Deleted ${duplicates.join(", ")} from repository secrets.`);
		}
	}
	if (repoSecrets.has("DISCORD_CHANGELOG_WEBHOOK")) {
		console.log(`\nMove DISCORD_CHANGELOG_WEBHOOK to the "${ANNOUNCE_ENV}" environment: ${LINKS.environments}`);
	}
}

async function main(): Promise<void> {
	if (!process.stdin.isTTY) throw new Error("Run this script in an interactive terminal.");
	if (spawnSync("gh", ["auth", "status", "-h", "github.com"], { stdio: "ignore" }).status !== 0) {
		throw new Error("Log in to GitHub CLI first: gh auth login");
	}

	const onlyChrome = flags.has("--chrome");
	const onlyFirefox = flags.has("--firefox");
	const everything = !onlyChrome && !onlyFirefox;

	if (everything) configureRepository();
	const secrets: Secrets = {
		...(everything || onlyChrome ? await collectChromeSecrets() : {}),
		...(everything || onlyFirefox ? await collectFirefoxSecrets() : {}),
	};

	const names = Object.keys(secrets);
	if (!names.length) {
		console.log("\nNo secrets to update.");
		return;
	}
	heading(`Saving to the "${RELEASE_ENV}" environment`);
	for (const [name, value] of Object.entries(secrets)) {
		gh(["secret", "set", name, "--env", RELEASE_ENV, "-R", REPO], value);
		console.log(`Saved ${name}`);
	}
	await removeRepositoryCopies(names);
}

main().catch((error: Error) => {
	console.error(error.message);
	process.exitCode = 1;
});
