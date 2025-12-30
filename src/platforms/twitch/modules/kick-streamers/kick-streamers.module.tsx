import { type Signal, signal } from "@preact/signals";
import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import styled from "styled-components";
import KickApi from "$kick/apis/kick.api.ts";
import TwitchModule from "$twitch/twitch.module.ts";
import type { ChannelResponse } from "$types/platforms/kick/kick.api.types.ts";
import type { KickStreamerInfo, StreamerInfo } from "$types/platforms/twitch/twitch.utils.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";

export default class KickStreamersModule extends TwitchModule {
	readonly config: TwitchModuleConfig = {
		name: "kick-streamers",
		appliers: [
			{
				type: "selector",
				selectors: ["#side-nav .side-nav-section"],
				callback: this.mountSection.bind(this),
				key: "kick-streamers",
				once: true,
			},
		],
		isModuleEnabledCallback: async () => await this.settingsService().getSettingsKey("showFollowsFromOtherPlatforms"),
	};

	private static readonly UPDATE_INTERVAL_MS = 2 * 60 * 1000;
	private updateInterval: NodeJS.Timeout | undefined;

	private readonly kickApi = new KickApi();
	private cachedKickStreamers: string[] | null = null;
	private readonly streamers: Signal<StreamerInfo[]> = signal([]);
	private platformIcons: Record<string, string> = {};

	async initialize() {
		try {
			const kick = await this.commonUtils().getAssetFile(this.workerService(), "brands/kick.svg");
			this.platformIcons = { kick };
		} catch (error) {
			this.logger.warn("Failed to load Kick platform icon", error);
		}
		try {
			await this.loadStreamersFromCommon();
			await this.refreshStatuses();
		} catch (error) {
			this.logger.error("Failed to initialize Kick streamers module", error);
		}
		if (this.updateInterval) clearInterval(this.updateInterval);
		this.updateInterval = setInterval(() => void this.refreshStatuses(), KickStreamersModule.UPDATE_INTERVAL_MS);
	}

	private mountSection(elements: Element[]) {
		if (document.querySelector(`.${this.getId()}`)) return;
		const parent = elements.at(0);
		if (!parent) return;
		const wrapper = this.commonUtils().createElementByParent(this.getId(), "div", parent);
		render(
			<KickStreamersSection
				streamers={this.streamers}
				onRefresh={this.refreshStatuses.bind(this)}
				platformIcons={this.platformIcons}
			/>,
			wrapper,
		);
	}

	private async refreshStatuses() {
		try {
			await this.loadStreamersFromCommon();
			const names = this.cachedKickStreamers;
			if (names === null) {
				return;
			}
			if (names.length === 0) {
				this.streamers.value = [];
				return;
			}
			const results = await Promise.all(
				names.map(async (name) => {
					try {
						const { data } = await this.kickApi.getChannel(name.toLowerCase());
						return this.mapChannelToInfo(data);
					} catch (error) {
						this.logger.warn(`Failed to fetch Kick channel: ${name}`, error);
						return undefined;
					}
				}),
			);
			const mapped = (results.filter(Boolean) as KickStreamerInfo[]).map((s) => ({ ...s, platform: "kick" }));
			mapped.sort((a, b) => b.viewerCount - a.viewerCount);
			this.streamers.value = mapped;
			this.logger.info("Kick statuses updated", mapped);
		} catch (error) {
			this.logger.error("Failed to refresh Kick statuses", error);
		}
	}

	private async loadStreamersFromCommon(): Promise<void> {
		try {
			const sharedFollows = await this.sharedStorageDataService().getStorageKey("sharedFollows");
			const kickFollows = sharedFollows.kick ?? [];
			this.cachedKickStreamers = kickFollows;
			this.logger.debug("Loaded Kick streamer nicknames for Twitch:", this.cachedKickStreamers);
		} catch (error) {
			this.logger.warn("Failed to load Kick streamers from shared storage", error);
			this.cachedKickStreamers = [];
		}
	}

	private mapChannelToInfo(channel: ChannelResponse): KickStreamerInfo {
		const isLive = Boolean(channel.livestream?.is_live);
		const category =
			channel.livestream?.categories?.[0]?.name ?? channel.livestream?.categories?.[0]?.category?.name ?? null;
		return {
			username: channel.user.username,
			isLive,
			game: category,
			avatar: channel.user.profile_pic ?? null,
			url: `https://kick.com/${channel.slug ?? channel.user.username}`,
			viewerCount: channel.livestream?.viewer_count ?? 0,
		};
	}
}

function KickStreamersSection({
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
		<SectionWrapper ref={rootRef}>
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
						{!compact &&
							(!s.isLive ? (
								<RightStatus>Offline</RightStatus>
							) : (
								<RightStatus>
									<LiveDot title="Live" /> <RightViewers>{formatViewers(s.viewerCount)}</RightViewers>
								</RightStatus>
							))}
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
`;

const SectionHeader = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 8px;
	color: #efeff1;
	font-size: 14px;
	font-weight: 700;
	text-transform: none;
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
	padding: ${(props) => (props.$compact ? "6px 0" : "6px 8px")};
	border-radius: 6px;
	text-decoration: none;
	color: inherit;
	opacity: ${(props) => (props.$offline ? 0.6 : 1)};
	justify-content: ${(props) => (props.$compact ? "center" : "flex-start")};

	&:hover {
		background: rgba(255, 255, 255, 0.08);
		text-decoration: none;
	}
`;

const Avatar = styled.img<{ $compact?: boolean }>`
	width: ${(props) => (props.$compact ? 32 : 30)}px;
	height: ${(props) => (props.$compact ? 32 : 30)}px;
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
	font-size: 14px;
	font-weight: 600;
	color: #efeff1;
	display: inline-flex;
	align-items: center;
	gap: 6px;
`;

const PlatformBadge = styled.img`
	position: absolute;
	bottom: -2px;
	left: -2px;
	width: 14px;
	height: 14px;
	background: rgba(0, 0, 0, 0.75);
	padding: 2px;
	border-radius: 0;
	z-index: 1;
`;

const Game = styled.div`
	font-size: 13px;
	color: #adadb8;
`;

const RightStatus = styled.div`
	margin-left: auto;
	font-size: 14px;
	color: #adadb8;
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
	font-size: 13px;
	color: #ffffff;
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
