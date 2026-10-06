import type { Logger } from "$shared/logger/logger.ts";
import { isViewerBadges, isViewerSummary } from "$shared/worker/enhancer-account/enhancer-account.guards.ts";
import type { EnhancerAccountService } from "$shared/worker/enhancer-account/enhancer-account.service.ts";
import { isEnhancerApiError } from "$shared/worker/moments/moments.guards.ts";
import type { SaveBadgeSlotRequest } from "$types/apis/enhancer-account.apis.ts";
import type {
	EnhancerProfileResult,
	GetEnhancerBadgesResponse,
	GetEnhancerProfileResponse,
	SaveEnhancerBadgeSlotResponse,
} from "$types/shared/worker/enhancer-account-worker.types.ts";

export class EnhancerProfileService {
	private static readonly HTTP_BASE_URL = "https://api.enhancer.at";

	constructor(
		private readonly logger: Logger,
		private readonly accountService: EnhancerAccountService,
	) {}

	getProfile(): Promise<GetEnhancerProfileResponse> {
		return this.request("/v1/me", { method: "GET" }, (body) => (isViewerSummary(body) ? body : undefined));
	}

	getBadges(): Promise<GetEnhancerBadgesResponse> {
		return this.request("/v1/me/badges", { method: "GET" }, (body) => (isViewerBadges(body) ? body : undefined));
	}

	saveBadgeSlot(slot: SaveBadgeSlotRequest): Promise<SaveEnhancerBadgeSlotResponse> {
		return this.request(
			"/v1/me/badges/slot",
			{ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(slot) },
			() => null,
		);
	}

	private async request<T>(
		path: string,
		init: RequestInit,
		parse: (body: unknown) => T | undefined,
	): Promise<EnhancerProfileResult<T>> {
		const headers = new Headers(init.headers);
		headers.set("Accept", "application/json");
		const result = await this.accountService.authorizedFetch(
			new URL(path, EnhancerProfileService.HTTP_BASE_URL).toString(),
			{
				...init,
				headers,
			},
		);
		if (result.kind === "unauthenticated") return { kind: "unauthenticated" };
		if (result.kind === "network-error") return { kind: "error", message: result.message };
		const body: unknown = await result.response.json().catch(() => null);
		if (!result.response.ok) {
			const message = isEnhancerApiError(body)
				? body.error.message
				: `Request failed with status ${result.response.status}`;
			this.logger.warn(`${init.method} ${path} failed: ${message}`);
			return { kind: "error", message };
		}
		const data = parse(body);
		if (data === undefined) return { kind: "error", message: "Invalid response" };
		return { kind: "ok", data };
	}
}
