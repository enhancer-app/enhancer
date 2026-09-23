import KickModule from "$kick/kick.module.ts";
import { WatchTimeUserCard } from "$shared/components/watchtime/watchtime-card.tsx";
import type { EnhancerStreamerWatchTimeData, XayoWatchtimePeriod } from "$types/apis/enhancer.apis.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";
import { signal } from "@preact/signals";
import { render } from "preact";

export default class KickWatchTimeModule extends KickModule {
	readonly config: KickModuleConfig = {
		name: "watchtime",
		appliers: [
			{
				type: "selector",
				selectors: ["#user-identity", ".ntv__user-info-modal"],
				callback: this.run.bind(this),
				key: "watchtime-user-identity",
			},
		],
		enabled: () => this.settings().xayoWatchtimeEnabled,
	};

	private run(identities: Element[]) {
		for (const identity of identities) {
			this.enhanceIdentity(identity);
		}
	}

	private enhanceIdentity(identity: Element) {
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
		const isCollapsed = signal(false);
		const period = signal<XayoWatchtimePeriod>(this.settings().xayoWatchtimePeriod);
		const cache = new Map<XayoWatchtimePeriod, EnhancerStreamerWatchTimeData[]>();
		let generation = 0;

		const loadWatchtime = async (target: XayoWatchtimePeriod) => {
			const cached = cache.get(target);
			if (cached) {
				data.value = cached;
				isError.value = false;
				isLoading.value = false;
				return;
			}
			const current = ++generation;
			isError.value = false;
			isLoading.value = true;
			try {
				const result = await this.enhancerApi().getWatchTime(username, target);
				if (current !== generation) return;
				cache.set(target, result);
				data.value = result;
			} catch (error) {
				this.logger.error(`Failed to fetch user popup watchtime ${username}`, error);
				if (current !== generation) return;
				isError.value = true;
			} finally {
				if (current === generation) isLoading.value = false;
			}
		};

		const fetchWatchtime = async () => {
			isCollapsed.value = false;
			if (isLoading.value || (data.value !== undefined && !isError.value)) return;
			await loadWatchtime(period.value);
		};

		const changePeriod = (next: XayoWatchtimePeriod) => {
			if (next === period.value) return;
			period.value = next;
			void loadWatchtime(next);
		};

		const toggleCollapsed = () => {
			isCollapsed.value = true;
		};

		render(
			<WatchTimeUserCard
				username={username}
				platform="kick"
				data={data}
				isLoading={isLoading}
				isError={isError}
				isCollapsed={isCollapsed}
				period={period}
				onPeriodChange={changePeriod}
				onFetch={fetchWatchtime}
				onToggleCollapse={toggleCollapsed}
			/>,
			wrapper,
		);
	}

	private getUsername(identity: Element): string | undefined {
		const profileLink = identity.querySelector<HTMLAnchorElement>('a[href^="https://kick.com/"], a[href^="/"]');
		if (!profileLink) return;

		const pathname = new URL(profileLink.href, window.location.href).pathname;
		return pathname.split("/").filter(Boolean)[0]?.toLowerCase();
	}
}
