import type { PlatformType } from "$types/shared/platform.types.ts";

export interface FollowsHomeHelperOptions {
	platform: PlatformType;
	isEnabled: () => boolean;
	resolveHomeUrl: () => Promise<string | null>;
	navigate: (url: string) => void;
}
