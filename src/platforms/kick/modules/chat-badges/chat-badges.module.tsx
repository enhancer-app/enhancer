import { render } from "preact";
import KickModule from "$kick/kick.module.ts";
import { BadgeComponent } from "$shared/components/badge/badge.component.tsx";
import { TooltipComponent } from "$shared/components/tooltip/tooltip.component.tsx";
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

	private async handleMessage({ message, element, isUsingNTV }: KickChatMessageEvent) {
		if (!(await this.isModuleEnabled())) return;
		const userBadges = this.enhancerApi().findUserBadgesForCurrentChannel(message.sender.id.toString());
		if (!userBadges?.length) return;

		const badgesContainers = [
			element.querySelector(".ntv__chat-message__badges"),
			element.querySelector(`button[title="${message.sender.username}"]`)?.parentElement,
		].filter(Boolean);

		if (!badgesContainers.length) return;

		for (const badge of userBadges) {
			const badgeWrapper = document.createElement("div");
			badgeWrapper.classList.add("enhancer-badges");
			badgeWrapper.style.alignSelf = "center";

			const lowestSourceUrl = this.commonUtils().getLowestBadgeSourceUrl(badge.sources);
			if (!lowestSourceUrl) throw new Error("Badge is missing a source url");
			render(
				<TooltipComponent content={<p>{badge.name}</p>} position="right" delay={200}>
					<BadgeComponent sourceUrl={lowestSourceUrl} name={badge.name} marginRight=".25em" marginTop="2px" />
				</TooltipComponent>,
				badgeWrapper,
			);

			for (const container of badgesContainers) {
				if (container) {
					container.insertBefore(badgeWrapper.cloneNode(true), container.firstChild);
				}
			}
		}
	}

	async initialize(): Promise<void> {
		this.commonUtils().createGlobalStyle(`
			.ntv__chat-message__badge {
				width: 18px;
				height: 18px;
			}
		`);
	}
}
