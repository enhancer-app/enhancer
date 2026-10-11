export type PlatformType = "twitch" | "kick";

export type PlatformConfig = {
	type: PlatformType;
	ignoredMutationSelectors?: string[];
};
