import TwitchModule from "$twitch/twitch.module.ts";
import type { TwitchChatMessageEvent } from "$types/platforms/twitch/twitch.events.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";

export default class ChatBadgesModule extends TwitchModule {
	config: TwitchModuleConfig = {
		name: "chat-badges",
		appliers: [
			{
				type: "event",
				key: "chat-badges",
				event: "twitch:chatMessage",
				callback: this.handleMessage.bind(this),
			},
		],
		enabled: () => this.settings().chatBadgesEnabled,
	};

	private async handleMessage({ message, element }: TwitchChatMessageEvent) {
		if (!(await this.isModuleEnabled())) return;
		const badgeList =
			element.querySelector(".seventv-chat-user-badge-list") ||
			element.querySelector(".chat-line__username-container")?.children[0] ||
			element.querySelector(".chat-line__message--badges");
		if (!badgeList) return;

		const userBadges = this.enhancerApi().findUserBadgesForCurrentChannel(message.user.userID) ?? [];
		const badgeIds = new Set(userBadges.map((badge) => badge.badgeId));
		badgeList.querySelectorAll<HTMLElement>(".enhancer-badges").forEach((badge) => {
			if (!badge.dataset.enhancerBadge || !badgeIds.has(badge.dataset.enhancerBadge)) badge.remove();
		});

		for (const badge of userBadges) {
			const lowestSourceUrl = this.commonUtils().getLowestBadgeSourceUrl(badge.sources);
			if (!lowestSourceUrl) throw new Error("Badge is missing a source url");
			if (badgeList.querySelector(`[data-enhancer-badge="${CSS.escape(badge.badgeId)}"]`)) continue;

			const badgeImage = document.createElement("img");
			badgeImage.classList.add("enhancer-badges");
			badgeImage.dataset.enhancerBadge = badge.badgeId;
			badgeImage.src = lowestSourceUrl;
			badgeImage.alt = badge.name;
			badgeImage.title = badge.name;
			badgeImage.width = 18;
			badgeImage.height = 18;
			badgeImage.style.marginTop = "2px";
			badgeImage.style.marginRight = ".25em";
			badgeImage.style.verticalAlign = "baseline";

			badgeList.insertBefore(badgeImage, badgeList.firstChild);
		}
	}
}
