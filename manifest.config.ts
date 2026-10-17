import data from "./package.json";
import type { ExtensionChannel } from "./src/types/shared/extension.types";

export const CHANNELS = {
	stable: {
		name: "Enhancer",
		geckoId: "{09b8dba2-ae33-4bea-8bf1-d85e50691408}",
		chromeId: "knaodoefkjbgmmilogebghadhmnphjih",
	},
	canary: {
		name: "Enhancer Canary",
		geckoId: "{e3cd2c48-15da-4b9f-b5a1-10f867857b5a}",
		chromeId: "lppdfejgfeffohjlllmkahfkoplnpmai",
	},
} satisfies Record<ExtensionChannel, { name: string; geckoId: string; chromeId: string }>;

export function getChannel(): ExtensionChannel {
	const channel = process.env.CHANNEL ?? "stable";
	if (channel !== "stable" && channel !== "canary") throw new Error(`Unknown CHANNEL "${channel}"`);
	return channel;
}

export function getVersion(channel: ExtensionChannel): string {
	if (channel === "stable") return data.version;
	const build = process.env.CANARY_BUILD ?? "0";
	if (!/^\d+$/.test(build) || Number(build) > 65535) throw new Error(`Invalid CANARY_BUILD "${build}"`);
	return `${data.version}.${Number(build)}`;
}

export function getManifest(isDevelopment: boolean, channel: ExtensionChannel = getChannel()) {
	let name = CHANNELS[channel].name;
	if (isDevelopment) name += " (development)";
	const version = getVersion(channel);
	const commit = process.env.CANARY_COMMIT?.slice(0, 7);
	return {
		manifest_version: 3,
		name,
		description: "Enhancer is open-sourced and free extension, which adds what is missing on streaming platforms.",
		version,
		...(channel === "canary" && { version_name: `${version} Canary${commit ? ` (${commit})` : ""}` }),
		permissions: ["storage", "unlimitedStorage"],
		action: {
			default_icon: "assets/enhancer/logo-128.png",
		},
		icons: {
			"128": "assets/enhancer/logo-128.png",
		},
		content_scripts: [
			{
				matches: ["*://*.twitch.tv/*", "*://*.kick.com/*"],
				js: ["inject.js", "worker.bridge.js"],
				all_frames: true,
				run_at: "document_end",
			},
		],
		background: {
			scripts: ["worker.background.js"],
			service_worker: "worker.background.js",
			type: "module",
		},
		web_accessible_resources: [
			{
				matches: ["*://*.twitch.tv/*", "*://*.kick.com/*"],
				resources: [
					"index.js",
					"index.js.map",
					"inject.js.map",
					"twitch.constants.js",
					"kick.constants.js",
					"assets/enhancer/*.svg",
					"assets/enhancer/*.png",
					"assets/brands/*.svg",
					"assets/brands/*.png",
					"assets/settings/*.svg",
					"assets/settings/*.png",
					"assets/modules/*.png",
					"assets/modules/*.svg",
					"assets/modules/*.ogg",
				],
			},
		],
		browser_specific_settings: {
			gecko: {
				id: CHANNELS[channel].geckoId,
				data_collection_permissions: {
					required: ["browsingActivity", "websiteContent"],
				},
			},
		},
	};
}
