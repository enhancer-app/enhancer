import { Logger } from "$shared/logger/logger.ts";

class SilentLogger extends Logger {
	constructor() {
		const environment = Object.getOwnPropertyDescriptor(globalThis, "__environment__");
		Object.defineProperty(globalThis, "__environment__", { configurable: true, value: "test" });
		super();

		if (environment) Object.defineProperty(globalThis, "__environment__", environment);
		else Reflect.deleteProperty(globalThis, "__environment__");
	}

	debug(): void {}
	info(): void {}
	warn(): void {}
	error(): void {}
}

export function createSilentLogger(): Logger {
	return new SilentLogger();
}
