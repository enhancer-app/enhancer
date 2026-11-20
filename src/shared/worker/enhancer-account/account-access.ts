import type { WorkerAction } from "$types/shared/worker/worker.types.ts";

// Page scripts on Twitch and Kick can reach the content-script bridge, so account actions only accept extension pages.
const EXTENSION_PAGE_ACTIONS: ReadonlySet<WorkerAction> = new Set<WorkerAction>([
	"getEnhancerAccount",
	"loginEnhancerAccount",
	"logoutEnhancerAccount",
	"getEnhancerProfile",
	"getEnhancerBadges",
	"saveEnhancerBadgeSlot",
	"getEnhancerBilling",
	"saveEnhancerChatStyle",
	"submitEnhancerNickname",
	"clearEnhancerNickname",
	"getEnhancerAccountCache",
]);

function isKickPage(senderUrl: string | undefined): boolean {
	if (typeof senderUrl !== "string" || !URL.canParse(senderUrl)) return false;
	const { protocol, hostname } = new URL(senderUrl);
	return protocol === "https:" && (hostname === "kick.com" || hostname.endsWith(".kick.com"));
}

export function isActionAllowedFrom(
	action: WorkerAction,
	senderUrl: string | undefined,
	extensionUrl: string,
): boolean {
	if (action === "syncKickSession") return isKickPage(senderUrl);
	if (!EXTENSION_PAGE_ACTIONS.has(action)) return true;
	return typeof senderUrl === "string" && extensionUrl.length > 0 && senderUrl.startsWith(extensionUrl);
}
