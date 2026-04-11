import { TooltipComponent } from "$shared/components/tooltip/tooltip.component.tsx";
import type { PinStreamerRequestEvent } from "$types/platforms/twitch/twitch.events.types.ts";
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
				type: "event",
				event: "twitch:pin-streamer-request",
				callback: this.onPinStreamerRequest.bind(this),
				key: "pin-streamer-request",
			},
			{
				type: "selector",
				selectors: [".followed-side-nav-header__dropdown-trigger p"],
				callback: this.hideSortDescription.bind(this),
				key: "pin-streamer-hide-sort-description",
				once: true,
			},
		],
		isModuleEnabledCallback: async () => await this.settingsService().getSettingsKey("pinnedStreamersEnabled"),
	};

	private observer: MutationObserver | undefined;
	private pinnedStreamers: string[] = [];
	private pinSignals = new Map<string, Signal<boolean>>();
	private pinButtons = new Map<string, HTMLElement>();

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
		this.pinSignals.set(channelID, isPinned);
		const button = this.commonUtils().createElementByParent("pin-streamer-button", "button", imageWrapper);
		this.pinButtons.set(channelID, button);
		button.onclick = async (event) => {
			event.preventDefault();
			event.stopPropagation();
			isPinned.value = await this.togglePinnedStreamer(channelID);
			if (isPinned.value) {
				button.style.display = "inline-block";
			} else button.style.display = "none";
			await this.resetListOrderAndUpdate();
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

	private async onPinStreamerRequest(request: PinStreamerRequestEvent) {
		if (!request.channelId) {
			await request.onResult({ status: "failed" });
			return;
		}
		const isModuleEnabled = await this.settingsService().getSettingsKey("pinnedStreamersEnabled");
		if (!isModuleEnabled) {
			await request.onResult({ status: "module_disabled" });
			return;
		}
		const isPinned = this.isPinnedStreamer(request.channelId);
		if (request.action === "status") {
			await request.onResult({ status: isPinned ? "already_pinned" : "not_pinned" });
			return;
		}
		if (request.action === "unpin") {
			if (!isPinned) {
				await request.onResult({ status: "not_pinned" });
				return;
			}
			try {
				await this.togglePinnedStreamer(request.channelId);
				const pinSignal = this.pinSignals.get(request.channelId);
				if (pinSignal) pinSignal.value = false;
				const pinButton = this.pinButtons.get(request.channelId);
				if (pinButton) pinButton.style.display = "none";
				await this.resetListOrderAndUpdate();
				await request.onResult({ status: "not_pinned" });
			} catch (_error) {
				await request.onResult({ status: "failed" });
			}
			return;
		}
		if (isPinned) {
			await request.onResult({ status: "already_pinned" });
			return;
		}
		try {
			await this.togglePinnedStreamer(request.channelId);
			const pinSignal = this.pinSignals.get(request.channelId);
			if (pinSignal) pinSignal.value = true;
			const pinButton = this.pinButtons.get(request.channelId);
			if (pinButton) pinButton.style.display = "inline-block";
			await this.resetListOrderAndUpdate();
			await request.onResult({ status: "pinned" });
		} catch (_error) {
			await request.onResult({ status: "failed" });
		}
	}

	private async togglePinnedStreamer(channelId: string): Promise<boolean> {
		const isPinned = this.isPinnedStreamer(channelId);
		if (isPinned) {
			this.pinnedStreamers = this.pinnedStreamers.filter((id) => id !== channelId);
		} else {
			this.pinnedStreamers.push(channelId);
		}
		await this.settingsService().updateSettingsKey("pinnedStreamers", this.pinnedStreamers);
		return !isPinned;
	}

	async initialize() {
		this.pinnedStreamers.push(...(await this.settingsService().getSettingsKey("pinnedStreamers")));
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
