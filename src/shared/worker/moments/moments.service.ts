import type { Logger } from "$shared/logger/logger.ts";
import type { EnhancerAccountService } from "$shared/worker/enhancer-account/enhancer-account.service.ts";
import {
	isChannelMomentResponse,
	isClaimMomentResponse,
	isClaimStatusResponse,
	isEnhancerApiError,
	isViewerMomentState,
} from "$shared/worker/moments/moments.guards.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type {
	ClaimMomentErrorReason,
	ClaimMomentResult,
	GetChannelMomentResponse,
	MomentClaimStatusResult,
	MomentViewerStateResult,
} from "$types/shared/worker/moments-worker.types.ts";

export class MomentsService {
	private static readonly HTTP_BASE_URL = "https://api.enhancer.at";
	private static readonly KNOWN_CLAIM_ERRORS: ReadonlySet<string> = new Set<ClaimMomentErrorReason>([
		"MOMENT_NOT_LIVE",
		"MOMENT_LIMIT_REACHED",
		"NO_PLATFORM_ACCOUNT",
	]);

	constructor(
		private readonly logger: Logger,
		private readonly accountService: EnhancerAccountService,
	) {}

	async getChannelMoment(platform: PlatformType, externalId: string): Promise<GetChannelMomentResponse> {
		if (!externalId) throw new Error("Channel external ID is required");
		try {
			const response = await fetch(this.url(`/v1/channel/${platform}/${encodeURIComponent(externalId)}/moment`), {
				headers: { Accept: "application/json" },
			});
			if (response.status === 404) return { kind: "ok", moment: null };
			const body: unknown = await response.json().catch(() => null);
			if (!response.ok) return { kind: "error", message: this.describeError(body, response.status) };
			if (!isChannelMomentResponse(body)) return { kind: "error", message: "Invalid moment response" };
			return { kind: "ok", moment: body.moment };
		} catch (error) {
			return { kind: "error", message: this.errorMessage(error) };
		}
	}

	async getClaimStatus(momentId: string, login: string): Promise<MomentClaimStatusResult> {
		const url = new URL(this.url(`/v1/moments/${encodeURIComponent(momentId)}/claim-status`));
		url.searchParams.set("login", login.toLowerCase());
		try {
			const response = await fetch(url, { headers: { Accept: "application/json" } });
			if (response.status === 404) return { kind: "not-found" };
			if (response.status === 429) return { kind: "rate-limited" };
			const body: unknown = await response.json().catch(() => null);
			if (!response.ok) return { kind: "error", message: this.describeError(body, response.status) };
			if (!isClaimStatusResponse(body)) return { kind: "error", message: "Invalid claim status response" };
			return { kind: "ok", status: body };
		} catch (error) {
			return { kind: "error", message: this.errorMessage(error) };
		}
	}

	async getViewerState(momentId: string): Promise<MomentViewerStateResult> {
		const result = await this.accountService.authorizedFetch(
			this.url(`/v1/me/moments/${encodeURIComponent(momentId)}`),
			{ headers: { Accept: "application/json" } },
		);
		if (result.kind === "unauthenticated") return { kind: "unauthenticated" };
		if (result.kind === "network-error") return { kind: "error", message: result.message };
		const body: unknown = await result.response.json().catch(() => null);
		if (!result.response.ok) return { kind: "error", message: this.describeError(body, result.response.status) };
		if (!isViewerMomentState(body)) return { kind: "error", message: "Invalid viewer state response" };
		return { kind: "ok", state: body };
	}

	async claim(momentId: string): Promise<ClaimMomentResult> {
		const result = await this.accountService.authorizedFetch(
			this.url(`/v1/me/moments/${encodeURIComponent(momentId)}/claim`),
			{ method: "POST", headers: { Accept: "application/json" } },
		);
		if (result.kind === "unauthenticated") {
			return { kind: "error", reason: "UNAUTHENTICATED", message: "Log in to your Enhancer account again" };
		}
		if (result.kind === "network-error") {
			return { kind: "error", reason: "NETWORK_ERROR", message: result.message };
		}
		const { response } = result;
		const body: unknown = await response.json().catch(() => null);
		if (response.ok) {
			if (isClaimMomentResponse(body)) return { kind: "ok", claim: body };
			return { kind: "error", reason: "UNKNOWN", message: "Invalid claim response" };
		}
		const message = this.describeError(body, response.status);
		this.logger.warn(`Moment claim failed: ${message}`);
		return { kind: "error", reason: this.mapClaimError(body, response.status), message };
	}

	private mapClaimError(body: unknown, status: number): ClaimMomentErrorReason {
		const code = isEnhancerApiError(body) ? body.error.code : null;
		if (code && MomentsService.KNOWN_CLAIM_ERRORS.has(code)) return code as ClaimMomentErrorReason;
		if (status === 403) return "FORBIDDEN";
		if (status === 404) return "NOT_FOUND";
		if (status === 409) return "MOMENT_NOT_LIVE";
		if (status >= 500 || status === 429) return "NETWORK_ERROR";
		return "UNKNOWN";
	}

	private describeError(body: unknown, status: number): string {
		if (isEnhancerApiError(body)) return `${body.error.code}: ${body.error.message}`;
		return `Request failed with status ${status}`;
	}

	private errorMessage(error: unknown): string {
		return error instanceof Error ? error.message : String(error);
	}

	private url(path: string): string {
		return new URL(path, MomentsService.HTTP_BASE_URL).toString();
	}
}
