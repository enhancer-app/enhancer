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

	private async handleMessage({ message, element, type }: TwitchChatMessageEvent) {
		if (!(await this.isModuleEnabled())) return;
		const badgeList =
			element.querySelector(".seventv-chat-user-badge-list") ||
			element.querySelector(".chat-line__username-container")?.children[0] ||
			element.querySelector(".chat-line__message--badges");
		if (!badgeList) return;

		const userBadges = this.enhancerApi().findUserBadgesForCurrentChannel(message.user.userID) ?? [];
		const badgeIds = new Set(userBadges.map((badge) => badge.badgeId));
		badgeList.querySelectorAll<HTMLElement>(".enhancer-badges").forEach((badge) => {
			if (!badge.dataset.enhancerBadge || !badgeIds.has(badge.dataset.enhancerBadge)) {
				render(null, badge);
				badge.remove();
			}
		});

		for (const badge of userBadges) {
			const lowestSourceUrl = this.commonUtils().getLowestBadgeSourceUrl(badge.sources);
			if (!lowestSourceUrl) throw new Error("Badge is missing a source url");
			if (badgeList.querySelector(`[data-enhancer-badge="${CSS.escape(badge.badgeId)}"]`)) continue;

			const badgeWrapper = document.createElement("span");
			badgeWrapper.classList.add("enhancer-badges");
			badgeWrapper.dataset.enhancerBadge = badge.badgeId;
			if (type === "7TV") {
				badgeWrapper.style.display = "inline-block";
				badgeWrapper.style.marginRight = ".25em";
				badgeWrapper.style.verticalAlign = "baseline";
			}
			render(
				<TooltipComponent content={<p>{badge.name}</p>} position="right">
					<img
						src={lowestSourceUrl}
						alt={badge.name}
						width={18}
						height={18}
						style={{
							marginRight: type === "7TV" ? 0 : ".25em",
							marginBottom: type === "7TV" ? 0 : "2.2px",
							verticalAlign: "middle",
						}}
					/>
				</TooltipComponent>,
				badgeWrapper,
			);

			badgeList.insertBefore(badgeWrapper, badgeList.firstChild);
		}
	}
}
