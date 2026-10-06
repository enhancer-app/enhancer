export type EnhancerAccountAction = "getEnhancerAccount" | "loginEnhancerAccount" | "logoutEnhancerAccount";

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
	displayName?: string;
	username?: string;
};

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
