import type { Logger } from "$shared/logger/logger.ts";
import type { EnhancerAccountService } from "$shared/worker/enhancer-account/enhancer-account.service.ts";
import {
	isChannelMarkResponse,
	isClaimMarkResponse,
	isClaimStatusResponse,
	isEnhancerApiError,
	isViewerMarkState,
} from "$shared/worker/marks/marks.guards.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type {
	ClaimMarkErrorReason,
	ClaimMarkResult,
	GetChannelMarkResponse,
	MarkClaimStatusResult,
	MarkViewerStateResult,
} from "$types/shared/worker/marks-worker.types.ts";

export class MarksService {
	private static readonly HTTP_BASE_URL = "https://api.enhancer.at";
	private static readonly KNOWN_CLAIM_ERRORS: ReadonlySet<string> = new Set<ClaimMarkErrorReason>([
		"MARK_NOT_LIVE",
		"MARK_LIMIT_REACHED",
		"NO_PLATFORM_ACCOUNT",
	]);

	constructor(
		private readonly logger: Logger,
		private readonly accountService: EnhancerAccountService,
	) {}

	async getChannelMark(platform: PlatformType, externalId: string): Promise<GetChannelMarkResponse> {
		if (!externalId) throw new Error("Channel external ID is required");
		try {
			const response = await fetch(this.url(`/v1/channel/${platform}/${encodeURIComponent(externalId)}/mark`), {
				headers: { Accept: "application/json" },
			});
			if (response.status === 404) return { kind: "ok", mark: null };
			const body: unknown = await response.json().catch(() => null);
			if (!response.ok) return { kind: "error", message: this.describeError(body, response.status) };
			if (!isChannelMarkResponse(body)) return { kind: "error", message: "Invalid mark response" };
			return { kind: "ok", mark: body.mark };
		} catch (error) {
			return { kind: "error", message: this.errorMessage(error) };
		}
	}

	async getClaimStatus(markId: string, login: string): Promise<MarkClaimStatusResult> {
		const url = new URL(this.url(`/v1/marks/${encodeURIComponent(markId)}/claim-status`));
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

	async getViewerState(markId: string): Promise<MarkViewerStateResult> {
		const result = await this.accountService.authorizedFetch(this.url(`/v1/me/marks/${encodeURIComponent(markId)}`), {
			headers: { Accept: "application/json" },
		});
		if (result.kind === "unauthenticated") return { kind: "unauthenticated" };
		if (result.kind === "network-error") return { kind: "error", message: result.message };
		const body: unknown = await result.response.json().catch(() => null);
		if (!result.response.ok) return { kind: "error", message: this.describeError(body, result.response.status) };
		if (!isViewerMarkState(body)) return { kind: "error", message: "Invalid viewer state response" };
		return { kind: "ok", state: body };
	}

	async claim(markId: string): Promise<ClaimMarkResult> {
		const result = await this.accountService.authorizedFetch(
			this.url(`/v1/me/marks/${encodeURIComponent(markId)}/claim`),
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
			if (isClaimMarkResponse(body)) return { kind: "ok", claim: body };
			return { kind: "error", reason: "UNKNOWN", message: "Invalid claim response" };
		}
		const message = this.describeError(body, response.status);
		this.logger.warn(`Mark claim failed: ${message}`);
		return { kind: "error", reason: this.mapClaimError(body, response.status), message };
	}

	private mapClaimError(body: unknown, status: number): ClaimMarkErrorReason {
		const code = isEnhancerApiError(body) ? body.error.code : null;
		if (code && MarksService.KNOWN_CLAIM_ERRORS.has(code)) return code as ClaimMarkErrorReason;
		if (status === 403) return "FORBIDDEN";
		if (status === 404) return "NOT_FOUND";
		if (status === 409) return "MARK_NOT_LIVE";
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
		return new URL(path, MarksService.HTTP_BASE_URL).toString();
	}
}
