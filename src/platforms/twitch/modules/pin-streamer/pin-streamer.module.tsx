import { ChannelPinsHelper } from "$shared/module/helpers/channel-pins.helper.ts";
import { TooltipComponent } from "$shared/components/tooltip/tooltip.component.tsx";
import { UsersByIdsQuery } from "$twitch/apis/twitch-queries.ts";
import type { UsersByIdsResponse } from "$types/platforms/twitch/twitch.api.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import { type Signal, signal } from "@preact/signals";
import gql from "graphql-tag";
import { render } from "preact";
import styled from "styled-components";
import TwitchModule from "../../twitch.module.ts";

const PINS_DISABLED_ATTRIBUTE = "data-enhancer-pins-disabled";

export default class PinStreamerModule extends TwitchModule {
	static readonly SKIP_PIN_SELECTOR =
		'.pin-streamer-button, a[data-test-selector="similarity-channel"], .side-nav-card__link--promoted-followed';

	readonly config: TwitchModuleConfig = {
		name: "pin-streamer",
		appliers: [
			{
				type: "selector",
				selectors: ["#side-nav .side-nav-section .tw-transition-group"],
				callback: this.run.bind(this),
				key: "pin-streamer",
				once: true,
			},
			{
				type: "selector",
				selectors: ['#side-nav .side-nav-section .side-nav-card__link[data-test-selector="followed-channel"]'],
				callback: (elements) => elements.forEach((element) => this.createPin(element)),
				key: "pin-streamer",
			},
			{
				type: "selector",
				selectors: [".followed-side-nav-header__dropdown-trigger p"],
				callback: this.hideSortDescription.bind(this),
				key: "pin-streamer-hide-sort-description",
				once: true,
			},
			{
				type: "event",
				event: "extension:start",
				callback: () => void this.migrateLegacyPins(),
				key: "pin-streamer-migrate",
			},
			{
				type: "event",
				event: "global:settings:pinnedStreamersEnabled",
				callback: (enabled) => this.setPinsEnabled(enabled),
				key: "pin-streamer-enabled-sync",
			},
			{
				type: "event",
				event: "extension:settings-refresh",
				callback: () => this.setPinsEnabled(this.globalSettings().pinnedStreamersEnabled),
				key: "pin-streamer-settings-refresh",
			},
		],
		enabled: () => this.globalSettings().pinnedStreamersEnabled,
	};

	private observer: MutationObserver | undefined;
	private pins!: ChannelPinsHelper;
	private pinnedStreamersEnabled = false;
	private pinButtonsByLogin = new Map<string, PinStreamerButtonState[]>();

	private run(elements: Element[]) {
		this.hookPersonalSectionsRender();
		const properElement = elements.at(0);
		if (!properElement) {
			this.logger.error("Failed to find proper wrapper for pins");
			return;
		}
		this.createObserver(properElement);
		[...properElement.children].forEach((child) => this.createPin(child));
	}

	private hideSortDescription(elements: Element[]): void {
		const firstElement = elements[0] as HTMLElement | undefined;
		if (firstElement) firstElement.style.display = "none";
	}

	private createObserver(element: Element) {
		this.observer?.disconnect();
		this.observer = new MutationObserver(async (list) => {
			for (const mutation of list) {
				if (mutation.type === "childList" && mutation.addedNodes) {
					for (const node of mutation.addedNodes) {
						try {
							this.createPin(node as Element);
						} catch (error) {
							this.logger.error(`Failed to create pin for node: ${error}`);
						}
					}
				}
				if (mutation.type === "childList" && mutation.removedNodes.length > 0) {
					this.prunePinButtons();
				}
			}
		});
		this.observer?.observe(element, { childList: true });
	}

	private createPin(channelWrapper: Element) {
		if (channelWrapper.querySelector(PinStreamerModule.SKIP_PIN_SELECTOR)) return;
		const login = this.getLoginBySideElement(channelWrapper);
		if (!login) return;
		const imageWrapper = channelWrapper.querySelector("div.tw-avatar");
		if (!imageWrapper) return;
		const isPinned = signal(this.pins.isPinned(login));
		const button = this.commonUtils().createElementByParent("pin-streamer-button", "button", imageWrapper);
		this.registerPinButton(login, { button, isPinned });
		button.onclick = async (event) => {
			event.preventDefault();
			event.stopPropagation();
			await this.pins.setPinned(login, !isPinned.value);
		};
		button.style.display = "none";
		channelWrapper.addEventListener("mouseover", () => {
			if (isPinned.value) return;
			button.style.display = "inline-block";
		});
		channelWrapper.addEventListener("mouseleave", () => {
			if (isPinned.value) return;
			button.style.display = "none";
		});

		if (isPinned.value) button.style.display = "inline-block";
		render(
			<TooltipComponent content={<PinStreamerTooltipComponent isPinned={isPinned} />} position="right">
				<PinStreamerComponent isPinned={isPinned} />
			</TooltipComponent>,
			button,
		);
		this.forceUpdatePersonalSection();
	}

	private getLoginBySideElement(element: Element): string | null {
		const link = element.matches("a[href]")
			? element
			: (element.querySelector<HTMLAnchorElement>("a.side-nav-card__link[href]") ?? null);
		const href = link?.getAttribute("href");
		const login = href?.split("?")[0].replace(/^\//, "").split("/")[0];
		return login ? login.toLowerCase() : null;
	}

	private hookPersonalSectionsRender() {
		const reactComponent = this.twitchUtils().getPersonalSections();
		if (!reactComponent) return;
		const originalFunction = reactComponent.render;
		reactComponent.render = (...data: any[]) => {
			this.updateFollowList();
			return originalFunction.apply(reactComponent, data);
		};
		this.logger.debug("Hooked into personal section render function");
	}

	private forceUpdatePersonalSection() {
		this.twitchUtils().getPersonalSections()?.forceUpdate();
	}

	private updateFollowList() {
		if (!this.pinnedStreamersEnabled) return;
		const props = this.twitchUtils().getPersonalSections()?.props;
		if (!props) return;

		const partitionByPinned = <T extends { user: { login: string } }>(items: T[]): [T[], T[]] => {
			const pinned: T[] = [];
			const other: T[] = [];
			for (const item of items) {
				if (this.pins.isPinned(String(item.user.login ?? ""))) {
					pinned.push(item);
				} else {
					other.push(item);
				}
			}
			return [pinned, other];
		};

		const [pinnedStreams, otherStreams] = partitionByPinned(props.section.streams);
		props.section.streams = [...pinnedStreams, ...otherStreams];

		const [pinnedOffline, otherOffline] = partitionByPinned(props.section.offlineChannels);
		props.section.offlineChannels = [...pinnedOffline, ...otherOffline];
	}

	private async resetListOrderAndUpdate(delayMs = 5) {
		const personalSections = this.twitchUtils().getPersonalSections();
		const props = personalSections?.props;
		const sort = props?.sort;
		if (!sort) return;
		const { type: currentSort, setSortType } = sort;
		const RECOMMENDED = "recommended";
		const VIEWERS_DESC = "viewers_desc";
		const nextSort = currentSort === RECOMMENDED ? VIEWERS_DESC : RECOMMENDED;
		setSortType(nextSort);
		await this.commonUtils().delay(delayMs);
		setSortType(currentSort);
		await this.commonUtils().delay(delayMs);
	}

	private async setPinsEnabled(enabled: boolean) {
		if (enabled === this.pinnedStreamersEnabled) return;
		this.pinnedStreamersEnabled = enabled;
		document.documentElement.toggleAttribute(PINS_DISABLED_ATTRIBUTE, !enabled);
		this.forceUpdatePersonalSection();
		await this.resetListOrderAndUpdate();
	}

	private async handlePinsChange(pins: ReadonlySet<string>) {
		this.prunePinButtons();
		for (const [login, states] of this.pinButtonsByLogin) {
			const isPinned = pins.has(login);
			for (const state of states) {
				state.isPinned.value = isPinned;
				state.button.style.display = isPinned ? "inline-block" : "none";
			}
		}
		if (!this.pinnedStreamersEnabled) return;
		this.forceUpdatePersonalSection();
		await this.resetListOrderAndUpdate();
	}

	private async migrateLegacyPins() {
		const legacy = this.settings().pinnedStreamers;
		if (legacy.length === 0) return;
		const client = this.twitchUtils().getApolloClient();
		if (!client) return;
		try {
			const response = (await client.query({
				query: gql(UsersByIdsQuery),
				variables: { ids: legacy },
				fetchPolicy: "network-only",
			})) as { data?: UsersByIdsResponse };
			const users = response.data?.users;
			if (!users) return;
			const found = new Set<string>();
			for (const user of users) {
				if (!user?.login) continue;
				found.add(user.id);
				await this.pins.setPinned(user.login, true);
			}
			await this.updateSetting(
				"pinnedStreamers",
				legacy.filter((id) => !found.has(id)),
			);
			this.logger.info(`Migrated ${found.size} pinned streamers`);
		} catch (error) {
			this.logger.warn("Failed to migrate pinned streamers:", error);
		}
	}

	private registerPinButton(login: string, state: PinStreamerButtonState) {
		const states = this.pinButtonsByLogin.get(login) ?? [];
		states.push(state);
		this.pinButtonsByLogin.set(login, states);
	}

	private prunePinButtons() {
		for (const [login, states] of this.pinButtonsByLogin) {
			const attachedStates = states.filter((state) => document.contains(state.button));
			if (attachedStates.length > 0) {
				this.pinButtonsByLogin.set(login, attachedStates);
			} else {
				this.pinButtonsByLogin.delete(login);
			}
		}
	}

	async initialize() {
		this.pinnedStreamersEnabled = this.globalSettings().pinnedStreamersEnabled;
		document.documentElement.toggleAttribute(PINS_DISABLED_ATTRIBUTE, !this.pinnedStreamersEnabled);
		this.pins = new ChannelPinsHelper("twitch", this.workerService());
		this.pins.onChange((pins) => void this.handlePinsChange(pins));
		await this.pins.load();
		this.commonUtils().createGlobalStyle(`
			.pin-streamer-button {
				order: 2;
				position: absolute;
				bottom: -6px;
				left: -4px;
			}
			html[${PINS_DISABLED_ATTRIBUTE}] .pin-streamer-button {
				display: none !important;
			}
		`);
	}
}

type PinStreamerButtonState = {
	button: HTMLElement;
	isPinned: Signal<boolean>;
};

interface PinStreamerComponentProps {
	isPinned: Signal<boolean>;
}

const ButtonWrapper = styled.div`
	display: inline-flex;
	align-items: center;
	justify-content: center;
	position: relative;
	z-index: 999;
`;

const PinButton = styled.button<{ $isPinned: boolean }>`
	background-color: ${(props) => (props.$isPinned ? "rgba(145, 71, 255, 0.5)" : "rgba(0, 0, 0, 0.4)")};
	border: none;
	border-radius: 3px;
	width: 16px;
	height: 16px;
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	transition: all 0.2s ease;
	color: ${(props) => (props.$isPinned ? "white" : "#ffffff")};
	padding: 0;

	&:hover {
		background-color: ${(props) => (props.$isPinned ? "rgba(145, 71, 255, 0.7)" : "rgba(0, 0, 0, 0.6)")};
		transform: scale(1.05);
	}

	&:active {
		transform: scale(0.95);
	}
`;

const StarIcon = styled.div<{ $isPinned: boolean }>`
	font-size: 12px;
	line-height: 1;
	font-weight: ${(props) => (props.$isPinned ? "bold" : "normal")};
	text-shadow: ${(props) => (props.$isPinned ? "0 0 3px rgba(145, 71, 255, 0.5)" : "none")};
`;

function PinStreamerComponent({ isPinned }: PinStreamerComponentProps) {
	return (
		<ButtonWrapper>
			<PinButton $isPinned={isPinned.value}>
				<StarIcon $isPinned={isPinned.value}>{isPinned.value ? "★" : "☆"}</StarIcon>
			</PinButton>
		</ButtonWrapper>
	);
}

function PinStreamerTooltipComponent({ isPinned }: PinStreamerComponentProps) {
	return <span>{isPinned.value ? "Unpin streamer" : "Pin streamer"}</span>;
}
