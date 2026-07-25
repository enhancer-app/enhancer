export type LogType = "debug" | "info" | "warn" | "error";

export type LogSource = "main" | "bridge" | "background";

export type LogEntry = {
	timestamp: number;
	level: LogType;
	context?: string;
	source: LogSource;
	data: string[];
};

export type LoggerOptions = {
	context?: string;
	source?: LogSource;
};
