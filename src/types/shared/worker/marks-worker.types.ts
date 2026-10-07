import type { ClaimMarkResponse, ClaimStatusResponse, PublicMark, ViewerMarkState } from "$types/apis/marks.apis.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";

export type MarksAction = "getChannelMark" | "getMarkClaimStatus" | "getMarkViewerState" | "claimMark";

export type GetChannelMarkPayload = {
	platform: PlatformType;
	externalId: string;
};

export type GetChannelMarkResponse = { kind: "ok"; mark: PublicMark | null } | { kind: "error"; message: string };

export type GetMarkClaimStatusPayload = {
	markId: string;
	login: string;
};

export type MarkClaimStatusResult =
	| { kind: "ok"; status: ClaimStatusResponse }
	| { kind: "not-found" }
	| { kind: "rate-limited" }
	| { kind: "error"; message: string };

export type MarkIdPayload = {
	markId: string;
};

export type MarkViewerStateResult =
	| { kind: "ok"; state: ViewerMarkState }
	| { kind: "unauthenticated" }
	| { kind: "error"; message: string };

export type ClaimMarkErrorReason =
	| "MARK_NOT_LIVE"
	| "MARK_LIMIT_REACHED"
	| "NO_PLATFORM_ACCOUNT"
	| "FORBIDDEN"
	| "NOT_FOUND"
	| "UNAUTHENTICATED"
	| "NETWORK_ERROR"
	| "UNKNOWN";

export type ClaimMarkResult =
	| { kind: "ok"; claim: ClaimMarkResponse }
	| { kind: "error"; reason: ClaimMarkErrorReason; message: string };
