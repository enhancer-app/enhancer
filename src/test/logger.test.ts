import { afterEach, expect, test } from "bun:test";
import { Logger } from "$shared/logger/logger.ts";

const originalEnvironment = (globalThis as typeof globalThis & { __environment__?: string }).__environment__;

afterEach(() => {
	Logger.clearLogs();
	Object.defineProperty(globalThis, "__environment__", { configurable: true, value: originalEnvironment });
});

test("removes credentials from exported log data", () => {
	Object.defineProperty(globalThis, "__environment__", { configurable: true, value: "production" });
	const logger = new Logger({ context: "test" });

	logger.error(
		"Authorization: Bearer authorization-secret",
		"Cookie: session=cookie-secret; refresh=refresh-secret",
		"https://example.test/?access_token=query-secret",
		{ token: "token-secret", nested: { authorization: "nested-secret" } },
	);

	const serialized = JSON.stringify(Logger.getLogs());

	expect(serialized).not.toContain("authorization-secret");
	expect(serialized).not.toContain("cookie-secret");
	expect(serialized).not.toContain("refresh-secret");
	expect(serialized).not.toContain("query-secret");
	expect(serialized).not.toContain("token-secret");
	expect(serialized).not.toContain("nested-secret");
	expect(serialized).toContain("[REDACTED]");
});

test("limits the total size of one log entry", () => {
	Object.defineProperty(globalThis, "__environment__", { configurable: true, value: "production" });
	const logger = new Logger({ context: "test" });

	logger.info(...Array.from({ length: 10 }, () => "x".repeat(2000)));

	const [entry] = Logger.getLogs();
	const entryLength = entry.data.reduce((total, value) => total + value.length, 0);

	expect(entryLength).toBeLessThanOrEqual(8192);
	expect(entry.data.at(-1)).toContain("TRUNCATED");
});
