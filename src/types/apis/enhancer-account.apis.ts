export type OidcTokenResponse = {
	access_token: string;
	refresh_token?: string;
	id_token?: string;
	expires_in: number;
	refresh_expires_in?: number;
	token_type: string;
};

export type OidcErrorResponse = {
	error: string;
	error_description?: string;
};

export type OidcIdTokenClaims = {
	sub?: string;
	nonce?: string;
	name?: string;
	preferred_username?: string;
	given_name?: string;
};

export type EnhancerViewerIdentity = {
	provider: string;
	providerUsername: string | null;
	providerDisplayName: string | null;
	avatarUrl: string | null;
};

export type EnhancerViewerSummary = {
	user: {
		id: string;
		username: string | null;
		displayName: string | null;
		primaryProvider: string | null;
		avatarUrl: string | null;
		createdAt: string;
	};
	identities: EnhancerViewerIdentity[];
};

export type EnhancerViewerBadge = {
	assignmentId: string;
	accountId: string;
	accountPlatform: "TWITCH" | "KICK";
	accountLogin: string;
	badgeId: string;
	name: string;
	sources: Record<string, string>;
	scope: "GLOBAL" | "CHANNEL";
	channelId: string | null;
	channelLogin: string | null;
	channelDisplayName: string | null;
	channelAvatarUrl: string | null;
	hidden: boolean;
	forced: boolean;
	visible: boolean;
	createdAt: string;
	cooldownUntil: string | null;
};

export type EnhancerViewerBadges = {
	global: EnhancerViewerBadge[];
	channels: EnhancerViewerBadge[];
};

export type SaveBadgeSlotRequest = {
	scope: "GLOBAL" | "CHANNEL";
	channelId?: string;
	accountId?: string;
	visibleAssignmentIds: string[];
};

export type EnhancerChatStylePerks = {
	glowAllowed: boolean;
	fontAllowed: boolean;
	nicknameAllowed: boolean;
	nicknameCooldownDays: number;
	fonts: string[];
};

export type EnhancerChatAccountStyle = {
	accountId: string;
	platform: "TWITCH" | "KICK";
	login: string;
	displayName: string;
	hasGlow: boolean;
	customFont: string | null;
	styleCooldownUntil: string | null;
	nickname: string | null;
	nicknameCooldownUntil: string | null;
	nicknamePending: string | null;
	nicknameRejected: { nickname: string; reason: string | null } | null;
};

export type EnhancerViewerBilling = {
	enabled: boolean;
	style: EnhancerChatStylePerks;
	accounts: EnhancerChatAccountStyle[];
};

export type SaveChatStyleRequest = {
	accountId: string;
	hasGlow: boolean;
	customFont: string | null;
};

export type SubmitNicknameRequest = {
	accountId: string;
	nickname: string;
};
