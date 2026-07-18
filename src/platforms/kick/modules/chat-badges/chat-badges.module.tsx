import KickModule from "$kick/kick.module.ts";
import type { KickChatMessageEvent } from "$types/platforms/kick/kick.events.types.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";

export default class ChatBadgesModule extends KickModule {
	config: KickModuleConfig = {
		name: "chat-badges",
		appliers: [
			{
				type: "event",
				key: "chat-badges",
				event: "kick:chatMessage",
				callback: this.handleMessage.bind(this),
			},
		],
		enabled: () => this.settings().chatBadgesEnabled,
	};

	private async handleMessage({ message, element }: KickChatMessageEvent) {
		if (!(await this.isModuleEnabled())) return;
		const badgesContainers = [
			element.querySelector(".ntv__chat-message__badges"),
			element.querySelector('button[data-prevent-expand="true"]')?.parentElement,
		].filter(Boolean);

		if (!badgesContainers.length) return;
		const userBadges = this.enhancerApi().findUserBadgesForCurrentChannel(message.sender.id.toString()) ?? [];
		const badgeIds = new Set(userBadges.map((badge) => badge.badgeId));
		for (const container of badgesContainers) {
			container?.querySelectorAll<HTMLElement>(".enhancer-badges").forEach((badge) => {
				if (!badge.dataset.enhancerBadge || !badgeIds.has(badge.dataset.enhancerBadge)) badge.remove();
			});
		}

		for (const badge of userBadges) {
			const lowestSourceUrl = this.commonUtils().getLowestBadgeSourceUrl(badge.sources);
			if (!lowestSourceUrl) throw new Error("Badge is missing a source url");

			for (const container of badgesContainers) {
				if (!container || container.querySelector(`[data-enhancer-badge="${CSS.escape(badge.badgeId)}"]`)) continue;
				const badgeImage = document.createElement("img");
				badgeImage.classList.add("enhancer-badges");
				badgeImage.dataset.enhancerBadge = badge.badgeId;
				badgeImage.src = lowestSourceUrl;
				badgeImage.alt = badge.name;
				badgeImage.title = badge.name;
				badgeImage.width = 18;
				badgeImage.height = 18;
				badgeImage.style.alignSelf = "center";
				badgeImage.style.marginRight = ".25em";
				container.insertBefore(badgeImage, container.firstChild);
			}
		}
	}
}
