import KickModule from "$kick/kick.module.ts";
import { WatchTimeUserCard } from "$shared/components/watchtime/watchtime-card.tsx";
import type { EnhancerStreamerWatchTimeData } from "$types/apis/enhancer.apis.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";
import { signal } from "@preact/signals";
import { render } from "preact";

export default class KickWatchTimeModule extends KickModule {
	readonly config: KickModuleConfig = {
		name: "watchtime",
		appliers: [
			{
				type: "selector",
				selectors: ["#user-identity"],
				callback: this.run.bind(this),
				key: "watchtime-user-identity",
			},
		],
		enabled: () => this.settings().xayoWatchtimeEnabled,
	};

	private run([identity]: Element[]) {
		const username = this.getUsername(identity);
		if (!username) return;

		const existing = identity.querySelector<HTMLElement>(`.${this.getId()}`);
		if (existing?.dataset.username === username) return;
		existing?.remove();

		const wrapper = this.commonUtils().createElementByParent(this.getId(), "div", identity);
		wrapper.dataset.username = username;
		const data = signal<undefined | EnhancerStreamerWatchTimeData[]>(undefined);
		const isLoading = signal(false);
		const isError = signal(false);

		const fetchWatchtime = async () => {
			if (isLoading.value) return;
			isError.value = false;
			isLoading.value = true;
			try {
				data.value = await this.enhancerApi().getWatchTime(username, this.settings().xayoWatchtimePeriod);
			} catch (error) {
				this.logger.error(`Failed to fetch user popup watchtime ${username}`, error);
				isError.value = true;
			} finally {
				isLoading.value = false;
			}
		};

		render(
			<WatchTimeUserCard
				username={username}
				platform="kick"
				data={data}
				isLoading={isLoading}
				isError={isError}
				onFetch={fetchWatchtime}
			/>,
			wrapper,
		);
	}

	private getUsername(identity: Element): string | undefined {
		return identity.querySelector<HTMLAnchorElement>('a[href^="https://kick.com/"]')?.textContent?.trim().toLowerCase();
	}
}
