import type { LogType, LoggerOptions } from "$types/shared/logger.types.ts";

export class Logger {
	private static readonly BASE_PREFIX = "\x1B[1;38;2;145;71;255mEnhancer";
	private static readonly LOG_TYPE_PREFIX: Record<LogType, string> = {
		debug: "\x1B[38;2;102;204;255mDEBUG\x1B[0m",
		info: "\x1B[38;2;102;255;178mINFO\x1B[0m",
		warn: "\x1B[38;2;255;215;102mWARN\x1B[0m",
		error: "\x1B[38;2;255;99;99mERROR\x1B[0m",
	};
	private readonly IS_DEVELOPMENT = __environment__ === "development";

	private readonly prefix: string;

	constructor(options: LoggerOptions = {}) {
		const { context } = options;
		this.prefix = context
			? `${Logger.BASE_PREFIX} \x1B[38;2;128;128;128m${context}\x1B[0m`
			: `${Logger.BASE_PREFIX}\x1B[0m`;
	}

	debug(...data: any[]): void {
		if (this.IS_DEVELOPMENT) this.sendLog("debug", ...data);
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
		console[logType](`${this.prefix} ${Logger.LOG_TYPE_PREFIX[logType]}`, ...data);
	}
}
