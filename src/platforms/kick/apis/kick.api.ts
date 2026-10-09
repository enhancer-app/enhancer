import { HttpClient } from "$shared/http/http-client.ts";
import { Logger } from "$shared/logger/logger.ts";
import type { ChannelResponse, KickCurrentUser } from "$types/platforms/kick/kick.api.types.ts";

export function isKickCurrentUser(value: unknown): value is KickCurrentUser {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const user = value as Record<string, unknown>;
	return typeof user.id === "number" && typeof user.username === "string" && typeof user.slug === "string";
}

export default class KickApi {
	private readonly logger = new Logger({ context: "kick-api" });
	private readonly httpClient = new HttpClient(this.logger);

	getChannel(channelName: string) {
		return this.httpClient.request<ChannelResponse>(`https://kick.com/api/v2/channels/${channelName}`);
	}

	async getCurrentUser(): Promise<KickCurrentUser | null> {
		try {
			const { data } = await this.httpClient.request<unknown>("https://kick.com/api/v1/user");
			return isKickCurrentUser(data) ? data : null;
		} catch {
			return null;
		}
	}
}
