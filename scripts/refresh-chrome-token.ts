import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { createInterface } from "node:readline/promises";

const REPO = "enhancer-app/enhancer";
const SCOPE = "https://www.googleapis.com/auth/chromewebstore";

if (process.argv.includes("--help")) {
	console.log(`Refresh the Chrome Web Store token and update secrets in ${REPO}.

Use a Desktop OAuth client in Google Cloud. No redirect URI configuration is needed.

Run: bun run chrome:refresh-token`);
	process.exit(0);
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

function setSecret(name: string, value: string): void {
	const result = spawnSync("gh", ["secret", "set", name, "-R", REPO], {
		input: value,
		encoding: "utf8",
		stdio: ["pipe", "ignore", "pipe"],
	});
	if (result.status !== 0)
		throw new Error(`Failed to save ${name}. Check GitHub CLI authentication and repository access.`);
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
		url.searchParams.set("scope", SCOPE);
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

async function main(): Promise<void> {
	if (!process.stdin.isTTY) throw new Error("Run this script in an interactive terminal.");
	if (spawnSync("gh", ["auth", "status", "-h", "github.com"], { stdio: "ignore" }).status !== 0) {
		throw new Error("Log in to GitHub CLI first: gh auth login");
	}
	console.log("Enter the client ID and secret from your Google Cloud Desktop OAuth client.");
	const clientId = await ask("Client ID: ");
	const clientSecret = await askSecret("Client secret (hidden input): ");
	if (!clientId || !clientSecret) throw new Error("Client ID and client secret are required.");
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
	const tokens: { refresh_token?: string; scope?: string } = await response.json();
	if (!tokens.refresh_token || !tokens.scope?.split(" ").includes(SCOPE)) {
		throw new Error("Google did not return a refresh token with Chrome Web Store access.");
	}
	setSecret("CHROME_CLIENT_ID", clientId);
	setSecret("CHROME_CLIENT_SECRET", clientSecret);
	setSecret("CHROME_REFRESH_TOKEN", tokens.refresh_token);
	console.log("Updated CHROME_CLIENT_ID, CHROME_CLIENT_SECRET, and CHROME_REFRESH_TOKEN on GitHub.");
}

main().catch((error: Error) => {
	console.error(error.message);
	process.exitCode = 1;
});
