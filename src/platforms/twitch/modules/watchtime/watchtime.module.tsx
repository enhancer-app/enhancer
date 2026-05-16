import type { EnhancerStreamerWatchTimeData } from "$types/apis/enhancer.apis.ts";
import type { UserCardComponent } from "$types/platforms/twitch/twitch.utils.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import { signal } from "@preact/signals";
import { render } from "preact";
import TwitchModule from "../../twitch.module.ts";
import {
	WatchTimePopupErrorMessage,
	WatchTimePopupLoadingMessage,
	WatchTimePopupMessage,
	WatchTimeUserCard,
} from "./watchtime-card.tsx";

export default class WatchTimeModule extends TwitchModule {
	private isLoadingPopupVisible = false;

	readonly config: TwitchModuleConfig = {
		name: "watchtime",
		appliers: [
			{
				type: "event",
				event: "twitch:chatInitialized",
				callback: this.addCommand.bind(this),
				key: "watchtime-chat",
				once: true,
			},
			{
				type: "selector",
				selectors: [".viewer-card"],
				callback: this.run.bind(this),
				key: "watchtime-usercard",
				once: true,
			},
		],
		enabled: () => this.settings().xayoWatchtimeEnabled,
	};

	private async run(elements: Element[]) {
		const isViewerCardPage = window.location.href.includes("/viewercard/");
		const wrappers = elements.map((parent) => {
			const element = this.commonUtils().createElementByParent(this.getId(), "div", parent);
			if (isViewerCardPage) {
				const prev = element.previousElementSibling;
				if (prev) prev.before(element);
			}
			return element;
		});
		const username = this.getUsernameFromUserCard(elements[0]);
		if (!username) {
			this.logger.error("Failed to found username from usercard");
			return;
		}

		const data = signal<undefined | EnhancerStreamerWatchTimeData[]>(undefined);
		const isLoading = signal(false);
		const isError = signal(false);

		const fetchWatchtime = async () => {
			if (isLoading.value) return;
			isError.value = false;
			isLoading.value = true;
			try {
				data.value = await this.enhancerApi().getWatchTime(username);
			} catch (error) {
				this.logger.error(`Failed to fetch usercard watchtime ${username}`, error);
				isError.value = true;
			} finally {
				isLoading.value = false;
			}
		};

		wrappers.forEach((element) => {
			render(
				<WatchTimeUserCard
					username={username}
					data={data}
					isLoading={isLoading}
					isError={isError}
					onFetch={fetchWatchtime}
				/>,
				element,
			);
		});
	}

	private getUsernameFromUserCard(element: Element): string | undefined {
		const userCardComponent = this.reactUtils().findReactParents<UserCardComponent>(
			this.reactUtils().getReactInstance(element),
			(n) => !!n.pendingProps?.targetLogin,
			20,
		);
		return userCardComponent?.pendingProps?.targetLogin?.toLowerCase();
	}

	private async addCommand() {
		if (!(await this.isModuleEnabled())) return;
		this.twitchUtils().addCommandToChat({
			name: "watchtime",
			description: "See user's watchtime from xayo.pl service",
			helpText: "Missing username",
			permissionLevel: 0,
			handler: async (username) => {
				const name = username.replace(/^@/, "");
				this.renderLoading(name);
				try {
					const data = await this.fetchWatchTimeByUserName(name.toLowerCase());
					this.renderWatchTime(name, data);
				} catch (error) {
					this.logger.error(`Failed to fetch watchtime for ${username}`, error);
					this.renderError(name);
				}
			},
			commandArgs: [
				{
					name: "username",
					isRequired: true,
				},
			],
		});
	}

	private async fetchWatchTimeByUserName(username: string): Promise<EnhancerStreamerWatchTimeData[]> {
		return await this.enhancerApi().getWatchTime(username);
	}

	private renderLoading(username: string) {
		this.isLoadingPopupVisible = true;
		this.emitter.emit("twitch:chatPopupMessage", {
			title: `Fetching data for ${username}`,
			autoclose: 60,
			content: <WatchTimePopupLoadingMessage />,
			onClose: () => this.handleLoadingPopupClose(),
		});
	}

	private renderWatchTime(username: string, data: EnhancerStreamerWatchTimeData[]) {
		if (!this.isLoadingPopupVisible) {
			return;
		}
		this.isLoadingPopupVisible = false;
		this.emitter.emit("twitch:chatPopupMessage", {
			title: `Watchtime for ${username}`,
			autoclose: 10,
			content: <WatchTimePopupMessage username={username} watchTime={data} />,
		});
	}

	private renderError(username: string) {
		if (!this.isLoadingPopupVisible) {
			return;
		}
		this.isLoadingPopupVisible = false;
		this.emitter.emit("twitch:chatPopupMessage", {
			title: `Failed to fetch watchtime for ${username}`,
			autoclose: 5,
			content: <WatchTimePopupErrorMessage />,
		});
	}

	private handleLoadingPopupClose() {
		this.isLoadingPopupVisible = false;
	}
}
