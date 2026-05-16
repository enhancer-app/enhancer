import type { PlatformType } from "$types/shared/platform.types.ts";

export function createWatchtimeId(platform: PlatformType, username: string): string {
	return `${platform}:${username.toLowerCase()}`;
}
