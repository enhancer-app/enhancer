import type { LogEntry, LogType, LoggerOptions } from "$types/shared/logger.types.ts";

export class Logger {
	private static readonly MAX_ENTRIES = 500;
	private static readonly BASE_PREFIX = "\x1B[1;38;2;145;71;255mEnhancer";
	private static readonly LOG_TYPE_PREFIX: Record<LogType, string> = {
		debug: "\x1B[38;2;102;204;255mDEBUG\x1B[0m",
		info: "\x1B[38;2;102;255;178mINFO\x1B[0m",
		warn: "\x1B[38;2;255;215;102mWARN\x1B[0m",
		error: "\x1B[38;2;255;99;99mERROR\x1B[0m",
	};
	private static readonly SENSITIVE_KEY = /authorization|cookie|token|password|secret|api[_-]?key|credential/i;
	private static readonly SENSITIVE_HEADER = /((?:authorization|cookie|set-cookie)\s*:\s*)[^\r\n]*/gi;
	private static readonly SENSITIVE_TEXT =
		/(["']?(?:authorization|cookie|set-cookie|token|password|secret|api[_-]?key|credential)["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^,;}\s]*)/gi;
	private static readonly SENSITIVE_QUERY =
		/([?&](?:authorization|cookie|token|access_token|refresh_token|password|secret|api[_-]?key|credential)=)[^&#\s]*/gi;
	private static readonly BEARER_TOKEN = /\bBearer\s+[^\s,;}]+/gi;
	private static readonly MAX_DATA_LENGTH = 2000;
	private static readonly MAX_ENTRY_LENGTH = 8192;
	private static entries: LogEntry[] = [];
	private readonly IS_DEVELOPMENT = __environment__ === "development";

	private readonly prefix: string;
	private readonly context?: string;
	private readonly source: LogEntry["source"];

	constructor(options: LoggerOptions = {}) {
		const { context, source = "main" } = options;
		this.context = context;
		this.source = source;
		this.prefix = context
			? `${Logger.BASE_PREFIX} \x1B[38;2;128;128;128m${context}\x1B[0m`
			: `${Logger.BASE_PREFIX}\x1B[0m`;
	}

	debug(...data: any[]): void {
		this.sendLog("debug", ...data);
	}

	info(...data: any[]): void {
		this.sendLog("info", ...data);
	}

	warn(...data: any[]): void {
		this.sendLog("warn", ...data);
	}

	error(...data: any[]): void {
		this.sendLog("error", ...data);
	}

	private sendLog(logType: LogType, ...data: any[]): void {
		const normalizedData: string[] = [];
		let entryLength = 0;
		for (const value of data) {
			const serialized = Logger.serialize(value);
			const remaining = Logger.MAX_ENTRY_LENGTH - entryLength;
			if (serialized.length > remaining) {
				const suffix = "...[TRUNCATED]";
				if (remaining > suffix.length) {
					normalizedData.push(`${serialized.slice(0, remaining - suffix.length)}${suffix}`);
				} else if (remaining > 0) {
					normalizedData.push(suffix.slice(0, remaining));
				}
				break;
			}
			normalizedData.push(serialized);
			entryLength += serialized.length;
		}
		Logger.entries.push({
			timestamp: Date.now(),
			level: logType,
			context: this.context,
			source: this.source,
			data: normalizedData,
		});
		if (Logger.entries.length > Logger.MAX_ENTRIES) Logger.entries.shift();
		if (logType !== "debug" || this.IS_DEVELOPMENT) {
			console[logType](`${this.prefix} ${Logger.LOG_TYPE_PREFIX[logType]}`, ...normalizedData);
		}
	}

	static getLogs(): LogEntry[] {
		return Logger.entries.map((entry) => ({ ...entry, data: [...entry.data] }));
	}

	static clearLogs(): void {
		Logger.entries = [];
	}

	private static serialize(value: unknown): string {
		if (value instanceof Error) {
			return Logger.sanitize(`${value.name}: ${value.message}${value.stack ? `\n${value.stack}` : ""}`);
		}
		if (typeof value === "string") return Logger.sanitize(value);
		if (value === undefined) return "undefined";
		if (value === null) return "null";
		if (typeof value === "bigint") return `${value.toString()}n`;
		if (typeof value !== "object") return Logger.sanitize(String(value));

		const seen = new WeakSet<object>();
		try {
			const serialized = JSON.stringify(value, (key, nestedValue) => {
				if (Logger.SENSITIVE_KEY.test(key)) return "[REDACTED]";
				if (nestedValue instanceof Error) {
					return { name: nestedValue.name, message: nestedValue.message, stack: nestedValue.stack };
				}
				if (nestedValue && typeof nestedValue === "object") {
					if (seen.has(nestedValue)) return "[Circular]";
					seen.add(nestedValue);
				}
				return nestedValue;
			});
			return Logger.sanitize(serialized ?? String(value));
		} catch {
			return Logger.sanitize(String(value));
		}
	}

	private static sanitize(value: string): string {
		return value
			.replace(Logger.SENSITIVE_HEADER, "$1[REDACTED]")
			.replace(Logger.BEARER_TOKEN, "Bearer [REDACTED]")
			.replace(Logger.SENSITIVE_TEXT, "$1[REDACTED]")
			.replace(Logger.SENSITIVE_QUERY, "$1[REDACTED]")
			.slice(0, Logger.MAX_DATA_LENGTH);
	}
}
