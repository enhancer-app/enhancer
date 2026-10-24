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
]);

export function isActionAllowedFrom(
	action: WorkerAction,
	senderUrl: string | undefined,
	extensionUrl: string,
): boolean {
	if (!EXTENSION_PAGE_ACTIONS.has(action)) return true;
	return typeof senderUrl === "string" && extensionUrl.length > 0 && senderUrl.startsWith(extensionUrl);
}
