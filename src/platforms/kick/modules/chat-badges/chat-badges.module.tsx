import KickModule from "$kick/kick.module.ts";
import { TooltipComponent } from "$shared/components/tooltip/tooltip.component.tsx";
import type { KickChatMessageEvent } from "$types/platforms/kick/kick.events.types.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";
import { render } from "preact";

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

	private async handleMessage({ message, element, isUsingNTV }: KickChatMessageEvent) {
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
				if (!badge.dataset.enhancerBadge || !badgeIds.has(badge.dataset.enhancerBadge)) {
					render(null, badge);
					badge.remove();
				}
			});
		}

		for (const badge of userBadges) {
			const lowestSourceUrl = this.commonUtils().getLowestBadgeSourceUrl(badge.sources);
			if (!lowestSourceUrl) {
				this.logger.warn(`Badge ${badge.badgeId} is missing a source url`);
				continue;
			}
			const size = isUsingNTV ? 16.38 : 19.38;

			for (const container of badgesContainers) {
				if (!container || container.querySelector(`[data-enhancer-badge="${CSS.escape(badge.badgeId)}"]`)) continue;
				const badgeWrapper = document.createElement("span");
				badgeWrapper.classList.add("enhancer-badges");
				badgeWrapper.dataset.enhancerBadge = badge.badgeId;
				badgeWrapper.style.alignSelf = "center";
				badgeWrapper.style.alignItems = "center";
				badgeWrapper.style.display = "inline-flex";
				render(
					<TooltipComponent content={<p>{badge.name}</p>} position="right" delay={200}>
						<img src={lowestSourceUrl} alt={badge.name} width={size} height={size} style={{ marginRight: ".25em" }} />
					</TooltipComponent>,
					badgeWrapper,
				);
				container.insertBefore(badgeWrapper, container.firstChild);
			}
		}
	}
}
