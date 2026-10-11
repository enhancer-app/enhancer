import type { ExtensionEnvironment } from "$types/shared/extension.types.ts";

// Content scripts share one global scope, and shared chunks cannot be imported here, so everything stays local.
(() => {
	const isFirefox = navigator.userAgent.includes("Firefox");
	const isCanary = __channel__ === "canary";
	const stableScriptId = "enhancer-script";

	const source: Record<ExtensionEnvironment, string> = {
		production: chrome.runtime.getURL("index.js"),
		development: `http://localhost:3360/dist/index.js?cache=${Math.random().toString()}`,
	};

	const injectScript = () => {
		const head = document.head || document.getElementsByTagName("head")[0] || document.documentElement;
		const script = document.createElement("script");
		script.type = "module";
		script.id = isCanary ? "enhancer-canary-script" : stableScriptId;
		// Firefox blocks injecting external scripts (e.g., from localhost), so we fall back to the production bundle.
		script.src = source[isFirefox ? "production" : (__environment__ ?? "production")];
		head.appendChild(script);
	};

	if (!isCanary) {
		injectScript();
		return;
	}
	// Stable injects synchronously at document_end, so one task later its script tag exists if it is enabled.
	setTimeout(() => {
		if (document.getElementById(stableScriptId)) {
			console.info("Enhancer Canary is inactive because Enhancer (stable) is running on this page.");
			return;
		}
		injectScript();
	}, 0);
})();
