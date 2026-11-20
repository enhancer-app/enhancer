export type ObservedRequest = {
	url: URL;
	method: string;
	body: unknown;
};

export type FetchObserver = {
	matches: (request: ObservedRequest) => boolean;
	onResponse: (response: Response, request: ObservedRequest) => void | Promise<void>;
};
