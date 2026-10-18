import type { PlatformType } from "$types/shared/platform.types.ts";

export type ExtensionEnvironment = "production" | "development";

export type ExtensionChannel = "stable" | "canary";

export type ExtensionMetadata = {
	version: string;
	environment: ExtensionEnvironment;
	channel: ExtensionChannel;
	platform: PlatformType;
};
