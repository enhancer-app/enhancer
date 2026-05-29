import type WorkerService from "$shared/worker/worker.service.ts";
import type { EnhancerBadgeSize } from "$types/apis/enhancer.apis.ts";
import type { RequestConfig, RequestResponse } from "$types/shared/http-client.types.ts";
import type { WaitForConfig } from "$types/shared/utils/common.utils.types.ts";
import { defaultAllowedOrigins } from "vite";

export default class CommonUtils {
	static readonly UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	static readonly BADGES_SIZE_ORDER: EnhancerBadgeSize[] = ["1x", "2x", "4x"];

	createElementByParent(name: string, tag: keyof HTMLElementTagNameMap, parent: Element) {
		const element = document.createElement(tag);
		element.classList.add(name);
		parent.appendChild(element);
		return element;
	}

	createEmptyElements(name: string, elements: Element[], tag: keyof HTMLElementTagNameMap = "div") {
		return elements.map((parent) => this.createElementByParent(name, tag, parent));
	}

	isUUID(text: string) {
		return CommonUtils.UUID_REGEX.test(text);
	}

	createGlobalStyle(css: string): HTMLStyleElement {
		let styleElement = document.getElementById("enhancer-style") as HTMLStyleElement;

		if (!styleElement) {
			styleElement = document.createElement("style");
			styleElement.id = "enhancer-style";
			document.head.appendChild(styleElement);
		}

		styleElement.textContent += css;

		return styleElement;
	}

	isValidUrl(url: string | undefined): url is string {
		return typeof url === "string" && url.startsWith("https://") && URL.canParse(url);
	}

	async waitFor<T>(
		predicate: () => Promise<T | undefined> | T | undefined,
		callback: (result: T, retry: number) => Promise<boolean> | boolean,
		config?: WaitForConfig,
	): Promise<boolean> {
		if (config?.initialDelay) await this.delay(config.initialDelay);
		const retries = config?.maxRetries ?? 1;
		for (let i = 0; i < retries; i++) {
			const result = await predicate();
			if (result) {
				return callback(result, i);
			}
			if (i < retries - 1) {
				await this.delay(config?.delay ?? 100);
			}
		}
		if (config?.notFoundCallback) {
			await config.notFoundCallback();
		}
		return false;
	}

	async delay(ms: number) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	async getAssetFile(workerApi: WorkerService, path: string, defaultValue = ""): Promise<string> {
		const response = await workerApi.send("getAssetsFile", { path });
		return response?.url || defaultValue;
	}

	timeInMsToTimestamp(timeInMs: number, type: "24" | "12" = "24"): string {
		if (!Number.isFinite(timeInMs) || timeInMs < 0) {
			return "--:--:--";
		}
		const date = new Date(timeInMs);
		const hours = date.getHours();
		const minutes = date.getMinutes().toString().padStart(2, "0");
		const seconds = date.getSeconds().toString().padStart(2, "0");
		if (type === "12") {
			const ampm = hours >= 12 ? "PM" : "AM";
			const twelveHour = (hours % 12 || 12).toString().padStart(2, "0");
			return `${twelveHour}:${minutes}:${seconds} ${ampm}`;
		}
		return `${hours.toString().padStart(2, "0")}:${minutes}:${seconds}`;
	}

	getLowestBadgeSourceUrl(sources: Partial<Record<EnhancerBadgeSize, string>>): string | null {
		for (const size of CommonUtils.BADGES_SIZE_ORDER) {
			if (sources[size]) {
				return sources[size];
			}
		}
		return null;
	}

	getHighestBadgeSourceUrl(sources: Partial<Record<EnhancerBadgeSize, string>>): string | null {
		for (let i = CommonUtils.BADGES_SIZE_ORDER.length - 1; i >= 0; i--) {
			const size = CommonUtils.BADGES_SIZE_ORDER[i];
			if (sources[size]) {
				return sources[size];
			}
		}
		return null;
	}
}
