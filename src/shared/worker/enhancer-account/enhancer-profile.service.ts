import type { Logger } from "$shared/logger/logger.ts";
import {
	isEnhancerApiError,
	isViewerBadges,
	isViewerBilling,
	isViewerSummary,
} from "$shared/worker/enhancer-account/enhancer-account.guards.ts";
import { EnhancerAccountCache } from "$shared/worker/enhancer-account/enhancer-account.cache.ts";
import type { EnhancerAccountService } from "$shared/worker/enhancer-account/enhancer-account.service.ts";
import type {
	SaveBadgeSlotRequest,
	SaveChatStyleRequest,
	SubmitNicknameRequest,
} from "$types/apis/enhancer-account.apis.ts";
import type {
	EnhancerAccountSnapshot,
	EnhancerProfileResult,
	GetEnhancerBadgesResponse,
	GetEnhancerBillingResponse,
	GetEnhancerProfileResponse,
	SaveEnhancerBadgeSlotResponse,
} from "$types/shared/worker/enhancer-account-worker.types.ts";

export class EnhancerProfileService {
	constructor(
		private readonly logger: Logger,
		private readonly accountService: EnhancerAccountService,
		private readonly cache = new EnhancerAccountCache(),
	) {}

	async getCached(): Promise<EnhancerAccountSnapshot> {
		const owner = await this.accountService.getCacheOwner();
		if (owner) return this.cache.read(owner);
		await this.cache.clear();
		return { updatedAt: 0 };
	}

	async getProfile(): Promise<GetEnhancerProfileResponse> {
		const result = await this.request("/v1/me", { method: "GET" }, (body) =>
			isViewerSummary(body) ? body : undefined,
		);
		await this.remember(result, (profile) => ({ profile }));
		return result;
	}

	async getBadges(): Promise<GetEnhancerBadgesResponse> {
		const result = await this.request("/v1/me/badges", { method: "GET" }, (body) =>
			isViewerBadges(body) ? body : undefined,
		);
		await this.remember(result, (badges) => ({ badges }));
		return result;
	}

	saveBadgeSlot(slot: SaveBadgeSlotRequest): Promise<SaveEnhancerBadgeSlotResponse> {
		return this.request(
			"/v1/me/badges/slot",
			{ method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(slot) },
			() => null,
		);
	}

	getBilling(): Promise<GetEnhancerBillingResponse> {
		return this.billing("/v1/me/billing", { method: "GET" });
	}

	saveChatStyle(style: SaveChatStyleRequest): Promise<GetEnhancerBillingResponse> {
		return this.billing("/v1/me/billing/appearance", this.json("PUT", style));
	}

	submitNickname(nickname: SubmitNicknameRequest): Promise<GetEnhancerBillingResponse> {
		return this.billing("/v1/me/billing/nickname", this.json("PUT", nickname));
	}

	clearNickname(accountId: string): Promise<GetEnhancerBillingResponse> {
		return this.billing(`/v1/me/billing/nickname?accountId=${encodeURIComponent(accountId)}`, { method: "DELETE" });
	}

	private async billing(path: string, init: RequestInit): Promise<GetEnhancerBillingResponse> {
		const result = await this.request(path, init, (body) => (isViewerBilling(body) ? body : undefined));
		await this.remember(result, (billing) => ({ billing }));
		return result;
	}

	private async remember<T>(
		result: EnhancerProfileResult<T>,
		patch: (data: T) => Omit<EnhancerAccountSnapshot, "updatedAt">,
	): Promise<void> {
		if (result.kind === "unauthenticated") return this.cache.clear();
		if (result.kind !== "ok") return;
		const owner = await this.accountService.getCacheOwner();
		if (owner) await this.cache.write(owner, patch(result.data));
	}

	private json(method: "PUT", body: unknown): RequestInit {
		return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
	}

	private async request<T>(
		path: string,
		init: RequestInit,
		parse: (body: unknown) => T | undefined,
	): Promise<EnhancerProfileResult<T>> {
		const headers = new Headers(init.headers);
		headers.set("Accept", "application/json");
		const result = await this.accountService.authorizedFetch(path, { ...init, headers });
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
