import type { Logger } from "$shared/logger/logger.ts";
import type { RequestConfig, RequestResponse } from "$types/shared/http-client.types.ts";

export class HttpClient {
	constructor(private readonly logger?: Logger) {}

	public async request<T>(url: string, config: RequestConfig = {}): Promise<RequestResponse<T>> {
		const {
			method = "GET",
			body,
			headers = {},
			responseType = "json",
			validateStatus = (status: number) => status >= 200 && status < 300,
			timeout,
		} = config;

		const controller = new AbortController();
		let timeoutId: ReturnType<typeof setTimeout> | undefined;

		if (timeout) {
			timeoutId = setTimeout(() => controller.abort(), timeout);
		}

		try {
			const requestHeaders: HeadersInit = { ...headers };
			if (body) {
				requestHeaders["Content-Type"] = "application/json";
			}

			this.logger?.debug(`${method.toUpperCase()} ${url}`);
			const response = await fetch(url, {
				method,
				body,
				headers: requestHeaders,
				signal: controller.signal,
			});
			this.logger?.debug(`${method.toUpperCase()} ${url} ${response.status}`);

			if (!validateStatus(response.status)) {
				throw new Error(`Request failed: ${response.status} ${response.statusText}`);
			}

			let data: T;
			switch (responseType) {
				case "text":
					data = (await response.text()) as T;
					break;
				case "blob":
					data = (await response.blob()) as T;
					break;
				case "arrayBuffer":
					data = (await response.arrayBuffer()) as T;
					break;
				default:
					data = await response.json();
			}

			return {
				data,
				status: response.status,
				response,
				headers: response.headers,
			};
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") {
				throw new Error(`Request timed out after ${timeout}ms`, { cause: error });
			}
			if (error instanceof Error) {
				throw error;
			}
			throw new Error(`Request failed: ${error}`, { cause: error });
		} finally {
			if (timeoutId) {
				clearTimeout(timeoutId);
			}
		}
	}
}
