import type { EnhancerMessageEvent } from "$types/apis/enhancer.apis.ts";

export type CommonEvents = {
	"extension:start": () => void | Promise<void>;
	"extension:settings-open": () => void | Promise<void>;
	"extension:settings-refresh": () => void | Promise<void>;
	"extension:watchtime-refresh": () => void | Promise<void>;
	"extension:joined-channel": () => void | Promise<void>;
	"extension:enhancer-api-refresh": () => void | Promise<void>;
	"extension:enhancer-api-message": (message: EnhancerMessageEvent) => void | Promise<void>;
};
