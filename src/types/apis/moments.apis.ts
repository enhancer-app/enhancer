export type MomentPlatform = "TWITCH" | "KICK";

export type PublicMomentStatus = "LIVE" | "ENDED";

export type RedeemResult =
	| "GRANTED"
	| "ALREADY_CLAIMED"
	| "NOT_LIVE"
	| "INVALID_CODE"
	| "LIMIT_REACHED"
	| "BLOCKED"
	| "ERROR";

export type ClaimStatus = RedeemResult | "NONE";

export type ClaimMethod = "ACCOUNT" | "CHAT";

export type PublicMomentChannel = {
	platform: MomentPlatform;
	externalChannelId: string;
	login: string;
	displayName: string;
	avatarUrl: string | null;
};

export type PublicMomentBadge = {
	id: string;
	name: string;
	description: string;
	sources: Record<string, string>;
};

export type PublicMoment = {
	id: string;
	channel: PublicMomentChannel;
	title: string;
	reason: string;
	code: string;
	redeemCommand: string;
	status: PublicMomentStatus;
	startedAt: string;
	endsAt: string;
	claimCount: number;
	maxClaims: number | null;
	graceSeconds: number;
	badge: PublicMomentBadge;
};

export type ChannelMomentResponse = {
	moment: PublicMoment | null;
};

export type ClaimStatusResponse = {
	status: ClaimStatus;
	claimedAt: string | null;
	attemptAt: string | null;
};

export type ViewerMomentClaim = {
	claimedAt: string;
	method: ClaimMethod;
};

export type ViewerMomentState = {
	eligible: boolean;
	accountLogin: string | null;
	claim: ViewerMomentClaim | null;
};

export type ClaimMomentResponse = {
	result: "GRANTED" | "ALREADY_CLAIMED";
	claimedAt: string;
	accountLogin: string | null;
	moment: { id: string; title: string };
	badge: { id: string; name: string; sources: Record<string, string> };
};

export type MomentUpdatedMessageData = {
	momentId: string;
	status: string;
};

export type MomentClaimsMessageData = {
	momentId: string;
	claimCount: number;
	maxClaims: number | null;
};
