import type { Logger } from "$shared/logger/logger.ts";
import type { RequestConfig, RequestResponse } from "$types/shared/http-client.types.ts";

export class HttpClient {
	constructor(private readonly logger?: Logger) {}

	public request<T>(
		url: string,
		config?: RequestConfig & { responseType?: "json" | "raw" },
	): Promise<RequestResponse<T>>;
	public request<_T extends string = string>(
		url: string,
		config: RequestConfig & { responseType: "text" },
	): Promise<RequestResponse<string>>;
	public request<_T extends Blob = Blob>(
		url: string,
		config: RequestConfig & { responseType: "blob" },
	): Promise<RequestResponse<Blob>>;
	public request<_T extends ArrayBuffer = ArrayBuffer>(
		url: string,
		config: RequestConfig & { responseType: "arrayBuffer" },
	): Promise<RequestResponse<ArrayBuffer>>;
	public async request<T>(
		url: string,
		config: RequestConfig = {},
	): Promise<RequestResponse<T | string | Blob | ArrayBuffer>> {
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

			let data: T | string | Blob | ArrayBuffer;

			switch (responseType) {
				case "text":
					data = await response.text();
					break;
				case "blob":
					data = await response.blob();
					break;
				case "arrayBuffer":
					data = await response.arrayBuffer();
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
