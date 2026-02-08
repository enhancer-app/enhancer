import type { ExtensionEnvironment } from "$types/shared/extension.types.ts";

const isFirefox = navigator.userAgent.includes("Firefox");

const source: Record<ExtensionEnvironment, string> = {
	production: chrome.runtime.getURL("index.js"),
	development: `http://localhost:3360/dist/index.js?cache=${Math.random().toString()}`,
};

const head = document.head || document.getElementsByTagName("head")[0] || document.documentElement;

const script = document.createElement("script");
script.type = "module";
script.id = "enhancer-script";
script.src = source[isFirefox ? "production" : (__environment__ ?? "production")];
// Firefox blocks injecting external scripts (e.g., from localhost), so we fall back to the production bundle.

head.appendChild(script);
