import { TooltipComponent } from "$shared/components/tooltip/tooltip.component.tsx";
import { ChattersQuery } from "$twitch/apis/twitch-queries.ts";
import type { ChattersResponse } from "$types/platforms/twitch/twitch.api.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import { type Signal, signal } from "@preact/signals";
import { render } from "preact";
import styled from "styled-components";
import TwitchModule from "../../twitch.module.ts";

export default class ChattersModule extends TwitchModule {
	private static URL_CONFIG = (url: string) =>
		!url.includes("clips.twitch.tv") && !url.includes("/team/") && !url.includes("/directory/");
	public static LOADING_VALUE = -1;

	config: TwitchModuleConfig = {
		name: "chatters",
		enabled: () => this.settings().chattersEnabled,
		appliers: [
			{
				type: "selector",
				selectors: ['strong[data-a-target="animated-channel-viewers-count"]'],
				callback: this.createTotalChattersComponent.bind(this),
				key: "chatters",
				validateUrl: ChattersModule.URL_CONFIG,
				useParent: true,
				once: true,
			},
			{
				type: "selector",
				selectors: [
					'div[data-a-target="channel-viewers-count"]',
					'p[data-test-selector="stream-info-card-component__description"]',
				],
				callback: this.createTotalChattersComponent.bind(this),
				key: "chatters",
				validateUrl: ChattersModule.URL_CONFIG,
				once: true,
			},
			{
				type: "selector",
				selectors: [".sunlight-live-indicator"],
				callback: this.createTotalChattersComponent.bind(this),
				key: "chatters-stream-manager",
				validateUrl: (url) => url.includes("/stream-manager"),
				useParent: true,
				once: true,
			},
			{
				type: "selector",
				selectors: [".ffz-stat-text.tw-stat__value"],
				callback: this.createTotalChattersComponent.bind(this),
				key: "chatters-ffz",
				validateUrl: ChattersModule.URL_CONFIG,
				useParent: true,
				once: true,
			},
			{
				type: "selector",
				selectors: [".tw-dialog-layer .tw-transition .tw-balloon"],
				callback: this.createIndividualChattersComponents.bind(this),
				key: "shared-chatters",
				validateUrl: ChattersModule.URL_CONFIG,
				useParent: true,
				once: true,
			},
			{
				type: "event",
				event: "twitch:chatInitialized",
				callback: this.reloadCounters.bind(this),
				key: "chatters",
			},
		],
	};

	private totalChattersCounter = signal(ChattersModule.LOADING_VALUE);
	private chattersCounters: Record<string, Signal<number>> = {};

	private updateInterval: NodeJS.Timeout | undefined;
	private channelDiscoveryTimer: NodeJS.Timeout | undefined;
	private lastUpdatedAt = 0;
	private lastKnownLogins = new Set<string>();
	private refreshingChatters = false;

	private static INDIVIDUAL_CHATTERS_COMPONENT_WRAPPER_CLASS = "enhancer-chat-counter-wrapper";
	private static UPDATE_INTERVAL_TIME = 30000;
	private static CHANNEL_DISCOVERY_INTERVAL_TIME = 5000;

	private findUsernameFromStatusIndicator(el?: Element | null): string | null {
		const container = el?.parentElement?.parentElement?.parentElement;
		return container?.querySelector("p")?.textContent ?? null;
	}

	private getUniqueLogins(channelList: string[] | undefined): string[] {
		return [
			...new Set<string>(
				[
					this.twitchUtils().getCurrentChannelByUrl(),
					this.twitchUtils().getCurrentChannelFromDirectTwitchPlayer(),
					...(channelList ?? []),
				].filter(Boolean) as string[],
			),
		];
	}

	private getFilteredIndicators(root: Element): Element[] {
		return Array.from(root.querySelectorAll(".tw-channel-status-indicator")).filter(
			(el) => !el.closest(".online-side-nav-channel-tooltip__body"),
		);
	}

	private async createTotalChattersComponent(elements: Element[], key: string) {
		if (!(await this.isModuleEnabled())) return;
		const wrappers = this.commonUtils().createEmptyElements(this.getId(), elements, "span");

		this.requestUpdate();
		if (this.updateInterval) clearInterval(this.updateInterval);
		this.updateInterval = setInterval(() => this.requestUpdate(), ChattersModule.UPDATE_INTERVAL_TIME);
		this.startChannelDiscovery();

		wrappers.forEach((element) => {
			render(
				<TooltipComponent
					content={
						<span>Chatters are logged-in users in a Twitch stream’s chatroom. Click here to refresh the counter.</span>
					}
					position="right"
				>
					<ChattersComponent
						click={this.refreshChatters.bind(this)}
						counter={this.totalChattersCounter}
						isStreamManager={key === "chatters-stream-manager"}
					/>
				</TooltipComponent>,
				element,
			);
		});
	}

	private async createIndividualChattersComponents(elements: Element[]) {
		if (!(await this.isModuleEnabled())) return;
		await this.commonUtils().delay(300);
		elements.forEach((root) => {
			const indicators = this.getFilteredIndicators(root);

			indicators.forEach((indicator) => {
				const username = this.findUsernameFromStatusIndicator(indicator)?.toLowerCase();
				if (!username) return;

				const counter = this.getOrCreateCounter(username, ChattersModule.LOADING_VALUE);
				if (counter !== undefined && indicator.parentElement) {
					let existing = indicator.parentElement.querySelector(
						`.${ChattersModule.INDIVIDUAL_CHATTERS_COMPONENT_WRAPPER_CLASS}`,
					);
					if (!existing) {
						existing = document.createElement("span");
						existing.className = ChattersModule.INDIVIDUAL_CHATTERS_COMPONENT_WRAPPER_CLASS;
						indicator.parentElement.appendChild(existing);
					}
					render(<ChattersComponent click={this.refreshChatters.bind(this)} counter={counter} />, existing);
				}
			});
		});

		const loadingLogins = Object.keys(this.chattersCounters).filter(
			(login) => this.chattersCounters[login].value === ChattersModule.LOADING_VALUE,
		);

		if (loadingLogins.length > 0) {
			await this.refreshChatters(loadingLogins);
		}
	}

	private async refreshChatters(loginsToUpdate: string[] = []) {
		if (this.refreshingChatters) return false;
		this.refreshingChatters = true;

		try {
			return await this.commonUtils().waitFor(
				() => this.getLoginsOrIsAllowedPage(),
				async (channelList) => {
					const uniqueLogins = this.getUniqueLogins(channelList === true ? undefined : channelList);
					this.logger.debug("Refreshing chatters for", uniqueLogins);

					const logins =
						loginsToUpdate.length > 0 ? uniqueLogins.filter((login) => loginsToUpdate.includes(login)) : uniqueLogins;

					await Promise.all(
						logins.map(async (login) => {
							try {
								const { data } = await this.twitchApi().gql<ChattersResponse>(ChattersQuery, {
									name: login.toLowerCase(),
								});
								const counter = this.getOrCreateCounter(login, data.channel.chatters.count);
								counter.value = data.channel.chatters.count;
								this.logger.info(`Refreshed chatters for ${login}`, counter.value);
							} catch (error) {
								this.logger.warn(`Failed to fetch chatters for ${login}`, error);
							}
						}),
					);

					for (const activeLogin of Object.keys(this.chattersCounters)) {
						if (!uniqueLogins.includes(activeLogin)) {
							delete this.chattersCounters[activeLogin];
						}
					}

					this.updateTotalChattersCounter();
					this.lastKnownLogins = new Set(uniqueLogins);
					this.lastUpdatedAt = Date.now();
					return true;
				},
				{ delay: 1000, maxRetries: 5, initialDelay: 30 },
			);
		} finally {
			this.refreshingChatters = false;
		}
	}

	private getLoginsOrIsAllowedPage() {
		if (this.twitchUtils().isDirectTwitchPlayer() || this.twitchUtils().isModeratorView() || this.isStreamManagerPage())
			return true;
		const logins = this.getLogins();
		return logins?.length ? logins : undefined;
	}

	private isStreamManagerPage() {
		return window.location.pathname.includes("/stream-manager");
	}

	private getLogins(): string[] | undefined {
		const streamInfo = this.twitchUtils().getStreamInfo();
		const sharedChatLogins = [...(this.twitchUtils().getChatInfo()?.props.sharedChatDataByChannelID.values() ?? [])]
			.filter((channel) => channel.status === "ACTIVE")
			.map((channel) => channel.login);
		const streamLogins = streamInfo
			? [
					streamInfo.channelLogin,
					...(streamInfo.costreamDetails?.topCostreamers.map((streamer) => streamer.login) ?? []),
					...(streamInfo.guestStarGuests ?? []).map((guest) => guest.user.login),
					...(streamInfo.guestList ?? []).map((guest) => guest.user.login),
				]
			: [];
		const allLoginsWithDuplicates = [...streamLogins, ...sharedChatLogins];
		const validLogins = allLoginsWithDuplicates.filter((login): login is string => login != null);
		const uniqueLogins = Array.from(new Set(validLogins));
		return uniqueLogins.length > 0 ? uniqueLogins : undefined;
	}

	private startChannelDiscovery() {
		if (this.channelDiscoveryTimer) return;

		let burstChecksLeft = 4;
		const check = async () => {
			await this.refreshIfChannelsChanged();
			const isBurst = burstChecksLeft > 0;
			burstChecksLeft = Math.max(0, burstChecksLeft - 1);
			this.channelDiscoveryTimer = setTimeout(check, isBurst ? 1000 : ChattersModule.CHANNEL_DISCOVERY_INTERVAL_TIME);
		};

		void check();
	}

	private async refreshIfChannelsChanged() {
		const channelList = this.getLoginsOrIsAllowedPage();
		if (channelList === undefined) return;

		const uniqueLogins = this.getUniqueLogins(channelList === true ? undefined : channelList);
		if (
			uniqueLogins.length === this.lastKnownLogins.size &&
			uniqueLogins.every((login) => this.lastKnownLogins.has(login))
		) {
			return;
		}

		await this.refreshChatters(uniqueLogins);
	}

	private updateTotalChattersCounter() {
		const chatterSignals = Object.values(this.chattersCounters);
		if (chatterSignals.length === 0) return ChattersModule.LOADING_VALUE;
		this.totalChattersCounter.value = chatterSignals.reduce((sum, chatterSignal) => {
			return chatterSignal.value === ChattersModule.LOADING_VALUE ? sum : sum + chatterSignal.value;
		}, 0);
	}

	private getOrCreateCounter(login: string, value: number) {
		let counter = this.chattersCounters[login];
		if (!counter) {
			counter = signal(value);
			this.chattersCounters[login] = counter;
		}
		return counter;
	}

	private async requestUpdate() {
		if (this.lastUpdatedAt + ChattersModule.UPDATE_INTERVAL_TIME * 0.75 >= Date.now()) {
			await this.updateAllEmptyCounters();
			return;
		}
		await this.refreshChatters();
	}

	private async updateAllEmptyCounters() {
		const emptyLogins = Object.entries(this.chattersCounters)
			.filter(([_, counter]) => {
				return counter.value === ChattersModule.LOADING_VALUE;
			})
			.map(([login]) => {
				return login;
			});
		if (emptyLogins.length < 1) return;
		await this.refreshChatters(emptyLogins);
	}

	private async reloadCounters() {
		if (!(await this.isModuleEnabled())) return;
		this.lastKnownLogins.clear();
		Object.values(this.chattersCounters).forEach((counter) => {
			counter.value = ChattersModule.LOADING_VALUE;
		});
		this.totalChattersCounter.value = ChattersModule.LOADING_VALUE;
		await this.refreshChatters();
	}
}

const Wrapper = styled.span`
	margin-left: 4px;
	color: #ff8280;
	font-weight: 600 !important;
	white-space: nowrap;

	html.tw-root--theme-light & {
		color: #b4232a;
	}

	&:hover {
		opacity: 0.75;
		cursor: pointer;
	}
`;

const StreamManagerWrapper = styled(Wrapper)`
	background-color: #ff8280;
	font-size: 11px;
	padding: 3px;
	border-radius: 4px;
	color: #000;
	margin-left: 8px;

	html.tw-root--theme-light & {
		background-color: #d64a4a;
		color: #ffffff;
	}
`;

const formatChatters = (chatters: number) =>
	Math.abs(chatters) < 10000 ? chatters.toString() : chatters.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const ChattersComponent = ({
	click,
	counter,
	isStreamManager,
}: {
	counter: Signal<number>;
	click: () => void;
	isStreamManager?: boolean;
}) => {
	const chatters = counter.value === ChattersModule.LOADING_VALUE ? "Loading..." : formatChatters(counter.value);
	const Container = isStreamManager ? StreamManagerWrapper : Wrapper;

	return <Container onClick={click}>{isStreamManager ? `CHATTERS: ${chatters}` : `(${chatters})`}</Container>;
};
