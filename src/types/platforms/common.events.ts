export type CommonEvents = {
	"extension:start": () => void | Promise<void>;
	"extension:settings-open": () => void | Promise<void>;
	"extension:settings-refresh": () => void | Promise<void>;
	"extension:watchtime-refresh": () => void | Promise<void>;
	"extension:joined-channel": () => void | Promise<void>;
};
