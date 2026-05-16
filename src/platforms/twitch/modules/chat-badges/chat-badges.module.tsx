import { BadgeComponent } from "$shared/components/badge/badge.component.tsx";
import { TooltipComponent } from "$shared/components/tooltip/tooltip.component.tsx";
import TwitchModule from "$twitch/twitch.module.ts";
import type { TwitchChatMessageEvent } from "$types/platforms/twitch/twitch.events.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import { render } from "preact";

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

		const userBadges = this.enhancerApi().findUserBadgesForCurrentChannel(message.user.userID);
		if (!userBadges) return;

		for (const badge of userBadges) {
			const badgeWrapper = document.createElement("div");
			badgeWrapper.classList.add("enhancer-badges");
			badgeWrapper.style.verticalAlign = "baseline";
			badgeWrapper.style.display = "inline-block";

			const lowestSourceUrl = this.commonUtils().getLowestBadgeSourceUrl(badge.sources);
			if (!lowestSourceUrl) throw new Error("Badge is missing a source url");
			render(
				<TooltipComponent content={<p>{badge.name}</p>} position="right">
					<BadgeComponent sourceUrl={lowestSourceUrl} name={badge.name} marginRight=".25em" marginTop="2px" />
				</TooltipComponent>,
				badgeWrapper,
			);

			if (badgeList.children.length < 1) badgeList.appendChild(badgeWrapper);
			else badgeList.insertBefore(badgeWrapper, badgeList.firstChild);
		}
	}
}
