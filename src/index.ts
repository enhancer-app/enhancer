import KickPlatform from "$kick/kick.platform.ts";
import type { ExtensionChannel, ExtensionEnvironment, ExtensionMetadata } from "$types/shared/extension.types.ts";
import TwitchPlatform from "./platforms/twitch/twitch.platform.ts";

(async () => {
	if (window.enhancer) return;
	const platform = getPlatform();
	window.enhancer = {
		version: __version__,
		environment: __environment__,
		channel: __channel__,
		platform: platform.getPlatformType(),
	};
	if (platform.shouldStart(window.location)) await platform.start();
})();

function getPlatform() {
	const hostname = window.location.hostname.toLowerCase();
	if (hostname.endsWith("twitch.tv")) return new TwitchPlatform();
	if (hostname.endsWith("kick.com")) return new KickPlatform();
	throw Error(`Unsupported host name ${hostname} (${window.location.href})`);
}

declare global {
	const __version__: string;
	const __environment__: ExtensionEnvironment;
	const __channel__: ExtensionChannel;

	interface Window {
		enhancer: ExtensionMetadata;
	}
}
