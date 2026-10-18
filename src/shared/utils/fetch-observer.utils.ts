import type { FetchObserver, ObservedRequest } from "$types/shared/utils/fetch-observer.types.ts";

const observers = new Set<FetchObserver>();
let installed = false;

export function observeFetch(observer: FetchObserver): () => void {
	observers.add(observer);
	if (!installed) install();
	return () => observers.delete(observer);
}

function install(): void {
	installed = true;
	const original = window.fetch;
	const observed = function (this: unknown, ...args: Parameters<typeof fetch>) {
		const promise = original.apply(this, args);
		const matched = findObservers(args);
		if (matched) {
			promise
				.then((response) => {
					for (const [observer, request] of matched) {
						Promise.resolve(observer.onResponse(response.clone(), request)).catch(() => {});
					}
				})
				.catch(() => {});
		}
		return promise;
	};
	window.fetch = Object.assign(observed, original);
}

function findObservers([input, init]: Parameters<typeof fetch>): [FetchObserver, ObservedRequest][] | null {
	try {
		const isRequest = input instanceof Request;
		const request: ObservedRequest = {
			url: new URL(isRequest ? input.url : String(input), location.href),
			method: (init?.method ?? (isRequest ? input.method : "GET")).toUpperCase(),
			body: init?.body,
		};
		const matched = [...observers].filter((observer) => observer.matches(request));
		return matched.length > 0 ? matched.map((observer) => [observer, request]) : null;
	} catch {
		return null;
	}
}
