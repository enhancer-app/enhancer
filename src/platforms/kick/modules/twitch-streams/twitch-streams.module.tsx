import KickModule from "$kick/kick.module.ts";
import SharedDataCache from "$shared/shared-data/shared-data.cache.ts";
import TwitchApi from "$twitch/apis/twitch.api.ts";
import type { TwitchMultiChannelResponse } from "$types/platforms/twitch/twitch.api.types.ts";
import type { StreamerInfo } from "$types/platforms/twitch/twitch.utils.types.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";
import { type Signal, signal } from "@preact/signals";
import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import styled from "styled-components";

export default class TwitchStreamsModule extends KickModule {
	readonly config: KickModuleConfig = {
		name: "twitch-streams",
		appliers: [
			{
				type: "selector",
				selectors: ["#sidebar-wrapper"],
				callback: this.mountSection.bind(this),
				once: true,
				key: "twitch-streams",
			},
		],
		enabled: () => this.settings()._showCrossPlatformFollows,
	};

	private static readonly UPDATE_INTERVAL_MS = 2 * 60 * 1000;
	private static readonly MAX_TWITCH_GQL_BATCH = 30;
	private updateInterval: NodeJS.Timeout | undefined;

	private siblingObserver: MutationObserver | undefined;
	private lastSiblingCount = 0;
	private remountDebounce: number | undefined;

	private readonly twitchApi = new TwitchApi({} as any);
	private readonly sharedDataCache = new SharedDataCache(this.workerService());
	private cachedTwitchStreamers: string[] | null = null;
	private readonly streamers: Signal<StreamerInfo[]> = signal([]);
	private platformIcons: Record<string, string> = {};

	async initialize() {
		try {
			const twitch = await this.commonUtils().getAssetFile(this.workerService(), "brands/twitch.svg");
			this.platformIcons = { twitch };
		} catch {}
		await this.loadStreamersFromCommon();
		await this.refreshStatuses();
		if (this.updateInterval) clearInterval(this.updateInterval);
		this.updateInterval = setInterval(() => void this.refreshStatuses(), TwitchStreamsModule.UPDATE_INTERVAL_MS);
	}

	private mountSection(elements: Element[]) {
		const root = elements[0];
		if (!root || document.querySelector(`#${this.getId()}`)) return;

		const target = this.findTargetElement(root);
		if (!target) {
			void this.tryMountWithRetry(root);
			return;
		}

		this.insertSection(target);
		this.observeSiblingCount(target.parentElement, root);
	}

	private insertSection(target: Element) {
		const wrapper = document.createElement("div");
		wrapper.id = this.getId();
		target.parentNode?.insertBefore(wrapper, target);

		render(
			<TwitchStreamsSection
				streamers={this.streamers}
				onRefresh={this.refreshStatuses.bind(this)}
				platformIcons={this.platformIcons}
			/>,
			wrapper,
		);
	}

	private observeSiblingCount(container?: Element | null, sidebar?: Element | null) {
		if (!container || !sidebar) return;

		this.siblingObserver?.disconnect();
		this.lastSiblingCount = container.children.length;

		this.siblingObserver = new MutationObserver(() => {
			const current = container.children.length;
			if (current === this.lastSiblingCount) return;

			this.lastSiblingCount = current;
			clearTimeout(this.remountDebounce);
			this.remountDebounce = window.setTimeout(() => this.remount(sidebar), 50);
		});

		this.siblingObserver.observe(container, { childList: true });
	}

	private async remount(sidebar: Element) {
		this.siblingObserver?.disconnect();

		const existing = document.querySelector(`#${this.getId()}`);
		if (existing) {
			try {
				render(null as any, existing);
			} catch {}
			existing.remove();
		}

		await this.tryMountWithRetry(sidebar);
	}

	private async tryMountWithRetry(sidebar: Element) {
		const mounted = await this.commonUtils().waitFor<Element | null>(
			() => {
				const liveSidebar = document.querySelector("#sidebar-wrapper") ?? sidebar;
				return this.findTargetElement(liveSidebar);
			},
			(target) => {
				if (!target) return false;
				this.insertSection(target);
				this.observeSiblingCount(target.parentElement, document.querySelector("#sidebar-wrapper") ?? sidebar);
				return true;
			},
			{ maxRetries: 20, delay: 100, initialDelay: 50 },
		);

		if (!mounted) this.logger.warn("Failed to remount Twitch streams section after retries");
	}

	private findTargetElement(wrapper?: Element): Element | null {
		return wrapper?.children[2]?.children[0]?.querySelector("section:nth-child(3)") ?? null;
	}

	private buildMultiChannelQuery(names: string[]) {
		const fields = names
			.map(
				(name, idx) =>
					`a${idx}: channel(name: "${name}") { id displayName owner { id login profileImageURL(width: 300) } stream { id title viewersCount game { name } } }`,
			)
			.join("\n");
		return `query {\n${fields}\n}`;
	}

	private getStreamerNames(): string[] {
		return this.cachedTwitchStreamers && this.cachedTwitchStreamers.length > 0 ? this.cachedTwitchStreamers : [];
	}

	private async loadStreamersFromCommon(): Promise<void> {
		try {
			const twitchFollows = this.sharedDataCache.get().crossPlatformFollows.twitch.follows;
			this.cachedTwitchStreamers = twitchFollows;
			this.logger.debug("Loaded Twitch streamer nicknames for Kick:", this.cachedTwitchStreamers);
		} catch (error) {
			this.logger.warn("Failed to load Twitch streamers from shared storage", error);
			this.cachedTwitchStreamers = [];
		}
	}

	private chunkArray<T>(items: T[], size: number): T[][] {
		const chunks: T[][] = [];
		for (let i = 0; i < items.length; i += size) {
			chunks.push(items.slice(i, i + size));
		}
		return chunks;
	}

	private async refreshStatuses() {
		try {
			await this.loadStreamersFromCommon();
			const source = this.getStreamerNames();
			if (source.length === 0) {
				this.streamers.value = [];
				return;
			}

			const batches = this.chunkArray(source, TwitchStreamsModule.MAX_TWITCH_GQL_BATCH);
			const aggregated: StreamerInfo[] = [];

			for (const batch of batches) {
				const query = this.buildMultiChannelQuery(batch.map((n) => n.toLowerCase()));
				const { data } = await this.twitchApi.gql<TwitchMultiChannelResponse>(query, {} as any);
				const mapped: StreamerInfo[] = batch.map((name, idx) => {
					const streamInfo = data?.[`a${idx}` as const];
					const isLive = Boolean(streamInfo?.stream);
					return {
						username: (streamInfo?.displayName as string) ?? name,
						isLive,
						game: (streamInfo?.stream?.game?.name as string) ?? null,
						avatar: (streamInfo?.owner?.profileImageURL as string) ?? null,
						url: `https://twitch.tv/${name}`,
						viewerCount: (streamInfo?.stream?.viewersCount as number) ?? 0,
						platform: "twitch",
					};
				});
				aggregated.push(...mapped);
			}

			aggregated.sort((a, b) => b.viewerCount - a.viewerCount);
			this.streamers.value = aggregated;
			this.logger.info("Twitch statuses updated", { total: aggregated.length });
		} catch (error) {
			this.logger.error("Failed to refresh Twitch statuses", error);
		}
	}
}

function TwitchStreamsSection({
	streamers,
	onRefresh,
	platformIcons,
}: {
	streamers: Signal<StreamerInfo[]>;
	onRefresh: () => void;
	platformIcons: Record<string, string>;
}) {
	const rootRef = useRef<HTMLDivElement>(null);
	const [compact, setCompact] = useState(false);
	const [visibleCount, setVisibleCount] = useState(5);

	const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}...` : text);

	useEffect(() => {
		const element = rootRef.current;
		if (!element) return;
		const COMPACT_WIDTH_PX = 80;
		const update = () => setCompact(element.clientWidth < COMPACT_WIDTH_PX);
		update();
		const ro = new ResizeObserver(update);
		ro.observe(element);
		return () => ro.disconnect();
	}, []);

	return (
		<SectionWrapper ref={rootRef} className="twitch-streams-section">
			{!compact && (
				<SectionHeader>
					<span>Other platforms</span>
					<RefreshButton onClick={onRefresh}>Refresh</RefreshButton>
				</SectionHeader>
			)}
			<List>
				{streamers.value.slice(0, visibleCount).map((s) => (
					<Item
						key={s.username}
						$offline={!s.isLive}
						$compact={compact}
						href={s.url}
						target="_blank"
						rel="noopener noreferrer"
					>
						<AvatarWrapper $compact={compact}>
							<Avatar $compact={compact} src={s.avatar ?? ""} alt={s.username} />
							{platformIcons[s.platform] ? <PlatformBadge src={platformIcons[s.platform]} alt={s.platform} /> : null}
						</AvatarWrapper>
						{!compact && (
							<ItemBody>
								<Name>{String(s.username)}</Name>
								<Game>{s.game ? truncate(s.game, 14) : ""}</Game>
							</ItemBody>
						)}
						{!compact && (
							<RightStatus>
								{s.isLive ? (
									<>
										<LiveDot title="Live" /> <RightViewers>{formatViewers(s.viewerCount)}</RightViewers>
									</>
								) : (
									<RightViewers>Offline</RightViewers>
								)}
							</RightStatus>
						)}
					</Item>
				))}
			</List>
			{streamers.value.length > 5 && !compact && (
				<Footer>
					<ExpandButton
						onClick={() => setVisibleCount((v) => Math.min(streamers.value.length, v + 5))}
						disabled={visibleCount >= streamers.value.length}
					>
						Show more
					</ExpandButton>
					<ExpandButton onClick={() => setVisibleCount(5)} disabled={visibleCount <= 5}>
						Show less
					</ExpandButton>
				</Footer>
			)}
		</SectionWrapper>
	);
}

const SectionWrapper = styled.div`
	margin: 12px 0 0 0;
	font-family: Inter, Inter Fallback;
`;

const SectionHeader = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 8px;
	color: #efeff1;
	font-size: 14px;
	font-weight: 600;
	text-transform: none;
    margin-left: 6px;
`;

const RefreshButton = styled.button`
	background: transparent;
	border: none;
	color: #adadb8;
	cursor: pointer;
	font-size: 11px;
	padding: 2px 4px;
	border-radius: 3px;
	transition: background 0.2s ease;

	&:hover {
		background: rgba(255, 255, 255, 0.08);
	}
`;

const List = styled.div`
	display: flex;
	flex-direction: column;
`;

const Item = styled.a<{ $offline: boolean; $compact?: boolean }>`
	display: flex;
	align-items: center;
	gap: ${(props) => (props.$compact ? 0 : 8)}px;
	padding: ${(props) => (props.$compact ? ".375rem .375rem" : ".375rem .375rem")};
	margin: ${(props) => (props.$compact ? "0px 0px" : "0px 14px")};;
	border-radius: 6px;
	text-decoration: none;
	color: inherit;
	opacity: ${(props) => (props.$offline ? 0.6 : 1)};
	justify-content: ${(props) => (props.$compact ? "center" : "flex-start")};
	box-sizing: border-box;

	&:hover {
		background: rgb(49, 53, 56);
		text-decoration: none;
	}
`;

const Avatar = styled.img<{ $compact?: boolean }>`
	width: ${(props) => (props.$compact ? 32 : 28)}px;
	height: ${(props) => (props.$compact ? 32 : 28)}px;
	border-radius: 50%;
	background: #232323;
`;

const AvatarWrapper = styled.div<{ $compact?: boolean }>`
	position: relative;
	display: inline-block;
	line-height: 0;
`;

const ItemBody = styled.div`
	display: flex;
	flex-direction: column;
	line-height: 1.1;
`;

const Name = styled.div`
	font-size: 13px;
	font-weight: 600;
	color: #efeff1;
	display: inline-flex;
	align-items: center;
	gap: 6px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
`;

const PlatformBadge = styled.img`
	position: absolute;
	bottom: -5px;
	left: -5px;
	width: 20px;
	height: 20px;
	padding: 2px;
	border-radius: 100%;
	z-index: 1;
`;

const Game = styled.div`
	font-size: 12px;
	color: rgba(255, 255, 255, 0.6);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
`;

const RightStatus = styled.div`
	margin-left: auto;
	font-size: 14px;
	color: rgba(146, 158, 166, 1);
	display: inline-flex;
	align-items: center;
	gap: 6px;
`;

const LiveDot = styled.span`
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #eb0400;
`;

const RightViewers = styled.span`
	font-size: 14px;
	color: rgb(255, 255, 255);
`;

const Footer = styled.div`
	display: flex;
	justify-content: center;
	padding: 6px 8px 0 8px;
	gap: 16px;
`;

const ExpandButton = styled.button`
	background: transparent;
	border: none;
	color: #adadb8;
	cursor: pointer;
	font-size: 11px;
	padding: 2px 4px;
	border-radius: 3px;
	transition: background 0.2s ease;

	&:hover {
		background: rgba(255, 255, 255, 0.08);
	}
`;

const formatViewers = (viewers: number) =>
	Math.abs(viewers) < 10000 ? viewers.toString() : viewers.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
