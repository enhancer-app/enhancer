export type MarkPlatform = "TWITCH" | "KICK";

export type PublicMarkStatus = "LIVE" | "ENDED";

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

export type PublicMarkChannel = {
	platform: MarkPlatform;
	externalChannelId: string;
	login: string;
	displayName: string;
	avatarUrl: string | null;
};

export type PublicMarkBadge = {
	id: string;
	name: string;
	description: string;
	sources: Record<string, string>;
};

export type PublicMark = {
	id: string;
	channel: PublicMarkChannel;
	title: string;
	reason: string;
	code: string;
	redeemCommand: string;
	status: PublicMarkStatus;
	startedAt: string;
	endsAt: string;
	claimCount: number;
	maxClaims: number | null;
	graceSeconds: number;
	badge: PublicMarkBadge;
};

export type ChannelMarkResponse = {
	mark: PublicMark | null;
};

export type ClaimStatusResponse = {
	status: ClaimStatus;
	claimedAt: string | null;
	attemptAt: string | null;
};

export type ViewerMarkClaim = {
	claimedAt: string;
	method: ClaimMethod;
};

export type ViewerMarkState = {
	eligible: boolean;
	accountLogin: string | null;
	claim: ViewerMarkClaim | null;
};

export type ClaimMarkResponse = {
	result: "GRANTED" | "ALREADY_CLAIMED";
	claimedAt: string;
	accountLogin: string | null;
	mark: { id: string; title: string };
	badge: { id: string; name: string; sources: Record<string, string> };
};

export type MarkUpdatedMessageData = {
	markId: string;
	status: string;
};

export type MarkClaimsMessageData = {
	markId: string;
	claimCount: number;
	maxClaims: number | null;
};
