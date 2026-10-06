import type {
	ClaimMomentResponse,
	ClaimStatusResponse,
	PublicMoment,
	ViewerMomentState,
} from "$types/apis/moments.apis.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";

export type MomentsAction = "getChannelMoment" | "getMomentClaimStatus" | "getMomentViewerState" | "claimMoment";

export type GetChannelMomentPayload = {
	platform: PlatformType;
	externalId: string;
};

export type GetChannelMomentResponse = { kind: "ok"; moment: PublicMoment | null } | { kind: "error"; message: string };

export type GetMomentClaimStatusPayload = {
	momentId: string;
	login: string;
};

export type MomentClaimStatusResult =
	| { kind: "ok"; status: ClaimStatusResponse }
	| { kind: "not-found" }
	| { kind: "rate-limited" }
	| { kind: "error"; message: string };

export type MomentIdPayload = {
	momentId: string;
};

export type MomentViewerStateResult =
	| { kind: "ok"; state: ViewerMomentState }
	| { kind: "unauthenticated" }
	| { kind: "error"; message: string };

export type ClaimMomentErrorReason =
	| "MOMENT_NOT_LIVE"
	| "MOMENT_LIMIT_REACHED"
	| "NO_PLATFORM_ACCOUNT"
	| "FORBIDDEN"
	| "NOT_FOUND"
	| "UNAUTHENTICATED"
	| "NETWORK_ERROR"
	| "UNKNOWN";

export type ClaimMomentResult =
	| { kind: "ok"; claim: ClaimMomentResponse }
	| { kind: "error"; reason: ClaimMomentErrorReason; message: string };
