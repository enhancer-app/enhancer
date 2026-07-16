import type { EnhancerChannelDto, EnhancerMessageEvent } from "$types/apis/enhancer.apis.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";

export interface InitializeEnhancerApiPayload {
	platform: PlatformType;
	clientId: string;
}

export interface JoinEnhancerChannelPayload {
	platform: PlatformType;
	externalId: string;
	clientId: string;
}

export interface GetEnhancerWatchTimePayload {
	username: string;
}

export interface DisconnectEnhancerApiPayload {
	platform: PlatformType;
	clientId: string;
}

export interface EnhancerApiUpdatedPayload {
	platform: PlatformType;
	clientId: string;
	scope: "GLOBAL" | "CHANNEL";
	externalId?: string;
	aggregate: EnhancerChannelDto | null;
}

export interface EnhancerApiMessagePayload {
	platform: PlatformType;
	clientId: string;
	message: EnhancerMessageEvent;
}
