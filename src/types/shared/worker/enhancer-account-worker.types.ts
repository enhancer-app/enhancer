import type { PlatformType } from "$types/shared/platform.types.ts";
import type { EnhancerApiEnvironment } from "$types/shared/enhancer-environment.types.ts";
import type {
	EnhancerViewerBadges,
	EnhancerViewerBilling,
	EnhancerViewerSummary,
	SaveBadgeSlotRequest,
	SaveChatStyleRequest,
	SubmitNicknameRequest,
} from "$types/apis/enhancer-account.apis.ts";

export type EnhancerAccountAction = "getEnhancerAccount" | "loginEnhancerAccount" | "logoutEnhancerAccount";

export type EnhancerProfileAction =
	| "getEnhancerProfile"
	| "getEnhancerBadges"
	| "saveEnhancerBadgeSlot"
	| "getEnhancerBilling"
	| "saveEnhancerChatStyle"
	| "submitEnhancerNickname"
	| "clearEnhancerNickname";

export type EnhancerProfileResult<T> =
	| { kind: "ok"; data: T }
	| { kind: "unauthenticated" }
	| { kind: "error"; message: string };

export type GetEnhancerProfileResponse = EnhancerProfileResult<EnhancerViewerSummary>;

export type GetEnhancerBadgesResponse = EnhancerProfileResult<EnhancerViewerBadges>;

export type SaveEnhancerBadgeSlotPayload = SaveBadgeSlotRequest;

export type SaveEnhancerBadgeSlotResponse = EnhancerProfileResult<null>;

export type GetEnhancerBillingResponse = EnhancerProfileResult<EnhancerViewerBilling>;

export type SaveEnhancerChatStylePayload = SaveChatStyleRequest;

export type SubmitEnhancerNicknamePayload = SubmitNicknameRequest;

export type ClearEnhancerNicknamePayload = { accountId: string };

export type EnhancerProfilePayload =
	| SaveEnhancerBadgeSlotPayload
	| SaveEnhancerChatStylePayload
	| SubmitEnhancerNicknamePayload
	| ClearEnhancerNicknamePayload;

export type EnhancerAccountProfile = {
	subject: string | null;
	displayName: string | null;
	username: string | null;
};

export type EnhancerAccountSession = {
	accessToken: string;
	refreshToken: string | null;
	idToken: string | null;
	expiresAt: number;
	refreshExpiresAt: number | null;
	profile: EnhancerAccountProfile;
};

export type EnhancerAccountState = {
	loggedIn: boolean;
	environment: EnhancerApiEnvironment;
	displayName?: string;
	username?: string;
};

export type StoredAccountSession = {
	environment: EnhancerApiEnvironment;
	iv: Uint8Array<ArrayBuffer>;
	data: ArrayBuffer;
	savedAt: number;
};

export interface AccountSessionStore {
	getSession(environment: EnhancerApiEnvironment): Promise<StoredAccountSession | undefined>;
	putSession(session: StoredAccountSession): Promise<void>;
	deleteSession(environment: EnhancerApiEnvironment): Promise<void>;
	getKey(): Promise<CryptoKey | undefined>;
	putKey(key: CryptoKey): Promise<void>;
}

export type IdentityApi = Pick<typeof chrome.identity, "getRedirectURL" | "launchWebAuthFlow">;

export type EnhancerAccountCard = {
	loggedIn: boolean;
	displayName: string | null;
	avatarUrl: string | null;
	badgesLoaded: boolean;
	badgeName: string | null;
	badgeImageUrl: string | null;
};

export type GetEnhancerAccountCardPayload = { platform: PlatformType };

export type LoginEnhancerAccountResponse =
	| { success: true; account: EnhancerAccountState }
	| { success: false; reason: "cancelled" | "failed"; message: string };

export type LogoutEnhancerAccountResponse = { success: true };

export type EnhancerAccountBroadcastPayload = {
	account: EnhancerAccountState;
	error?: string;
};

export type PkceChallenge = {
	verifier: string;
	challenge: string;
	method: "S256";
};

export type AuthorizationRequest = {
	url: string;
	state: string;
	nonce: string;
	verifier: string;
	redirectUri: string;
};

export type AuthorizationCallback = { code: string } | { error: string; cancelled: boolean };

export type AuthorizedRequestResult =
	| { kind: "response"; response: Response }
	| { kind: "unauthenticated" }
	| { kind: "network-error"; message: string };
