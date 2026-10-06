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
