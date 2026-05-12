import { TooltipComponent } from "$shared/components/tooltip/tooltip.component.tsx";
import type { TwitchPinnedStreamerSyncEvent } from "$types/platforms/twitch/twitch.events.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import { type Signal, signal } from "@preact/signals";
import { render } from "preact";
import styled from "styled-components";
import TwitchModule from "../../twitch.module.ts";

export default class PinStreamerModule extends TwitchModule {
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
				event: "twitch:pinnedStreamer:sync",
				callback: this.handlePinnedStreamerSync.bind(this),
				key: "pin-streamer-sync",
			},
			{
				type: "event",
				event: "twitch:settings:pinnedStreamersEnabled",
				callback: async (enabled) => {
					this.pinnedStreamersEnabled = enabled;
					if (!enabled) await this.resetListOrderAndUpdate();
				},
				key: "pin-streamer-enabled-sync",
			},
		],
		enabled: () => this.settings().pinnedStreamersEnabled,
	};

	private observer: MutationObserver | undefined;
	private pinnedStreamers: string[] = [];
	private pinnedStreamersEnabled = false;
	private pinButtonsByChannelId = new Map<string, PinStreamerButtonState[]>();

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
		if (
			channelWrapper.querySelector(".pin-streamer-button") ||
			channelWrapper.querySelector('a[data-test-selector="similarity-channel"]') ||
			channelWrapper.querySelector(".side-nav-card__link--promoted-followed")
		)
			return;
		const channelID = this.twitchUtils().getUserIdBySideElement(channelWrapper);
		if (!channelID) return;
		const imageWrapper = channelWrapper.querySelector("div.tw-avatar");
		if (!imageWrapper) return;
		const isPinned = signal(this.isPinnedStreamer(channelID));
		const button = this.commonUtils().createElementByParent("pin-streamer-button", "button", imageWrapper);
		this.registerPinButton(channelID, { button, isPinned });
		button.onclick = async (event) => {
			event.preventDefault();
			event.stopPropagation();
			await this.emitPinnedStreamerSync({ channelId: channelID, isPinned: !isPinned.value });
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

	private hookPersonalSectionsRender() {
		const reactComponent = this.twitchUtils().getPersonalSections();
		if (!reactComponent) return;
		const originalFunction = reactComponent.render;
		reactComponent.render = (...data: any[]) => {
			this.logger.debug("Rendering personal section channels");
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

		const partitionByPinned = <T extends { user: { id: string } }>(items: T[]): [T[], T[]] => {
			const pinned: T[] = [];
			const other: T[] = [];
			for (const item of items) {
				if (this.isPinnedStreamer(item.user.id)) {
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

	private isPinnedStreamer(channelId: string): boolean {
		return this.pinnedStreamers.includes(channelId);
	}

	private async emitPinnedStreamerSync(payload: TwitchPinnedStreamerSyncEvent) {
		const changed = await this.applyPinnedStreamerSync(payload);
		if (!changed) return;
		this.emitter.emit("twitch:pinnedStreamer:sync", { ...payload, source: "pin-streamer" });
	}

	private async handlePinnedStreamerSync(payload: TwitchPinnedStreamerSyncEvent) {
		if (payload.source === "pin-streamer") return;
		await this.applyPinnedStreamerSync(payload);
	}

	private async applyPinnedStreamerSync({ channelId, isPinned }: TwitchPinnedStreamerSyncEvent): Promise<boolean> {
		if (!this.pinnedStreamersEnabled) return false;
		const changed = await this.setPinnedStreamer(channelId, isPinned);
		this.updatePinButtons(channelId, isPinned);
		if (!changed) return false;
		this.forceUpdatePersonalSection();
		await this.resetListOrderAndUpdate();
		return true;
	}

	private async setPinnedStreamer(channelId: string, isPinned: boolean): Promise<boolean> {
		const currentValue = this.isPinnedStreamer(channelId);
		if (currentValue === isPinned) return false;
		if (isPinned) {
			this.pinnedStreamers.push(channelId);
		} else {
			this.pinnedStreamers = this.pinnedStreamers.filter((id) => id !== channelId);
		}
		await this.updateSetting("pinnedStreamers", this.pinnedStreamers);
		return true;
	}

	private registerPinButton(channelId: string, state: PinStreamerButtonState) {
		const states = this.pinButtonsByChannelId.get(channelId) ?? [];
		states.push(state);
		this.pinButtonsByChannelId.set(channelId, states);
	}

	private updatePinButtons(channelId: string, isPinned: boolean) {
		const states = this.prunePinButtons(channelId);
		for (const state of states) {
			state.isPinned.value = isPinned;
			state.button.style.display = isPinned ? "inline-block" : "none";
		}
	}

	private prunePinButtons(channelId?: string): PinStreamerButtonState[] {
		const entries = channelId
			? ([[channelId, this.pinButtonsByChannelId.get(channelId) ?? []]] as [string, PinStreamerButtonState[]][])
			: this.pinButtonsByChannelId.entries();
		let activeStates: PinStreamerButtonState[] = [];
		for (const [id, states] of entries) {
			const attachedStates = states.filter((state) => document.contains(state.button));
			if (attachedStates.length > 0) {
				this.pinButtonsByChannelId.set(id, attachedStates);
			} else {
				this.pinButtonsByChannelId.delete(id);
			}
			if (id === channelId) activeStates = attachedStates;
		}
		return activeStates;
	}

	initialize() {
		this.pinnedStreamers.push(...this.settings().pinnedStreamers);
		this.pinnedStreamersEnabled = this.settings().pinnedStreamersEnabled;
		this.commonUtils().createGlobalStyle(`
			.pin-streamer-button {
				order: 2;
				position: absolute;
				bottom: -6px;
				left: -4px;
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
