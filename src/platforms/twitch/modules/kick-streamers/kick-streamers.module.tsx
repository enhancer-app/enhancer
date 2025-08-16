import KickApi from "$kick/apis/kick.api.ts";
import TwitchModule from "$twitch/twitch.module.ts";
import type { ChannelResponse } from "$types/platforms/kick/kick.api.types.ts";
import type { TwitchModuleConfig } from "$types/shared/module/module.types.ts";
import { type Signal, signal } from "@preact/signals";
import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import styled from "styled-components";
import type { KickStreamerInfo } from "$types/platforms/twitch/twitch.utils.types.ts";

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
	};

	private static readonly UPDATE_INTERVAL_MS = 5 * 60 * 1000;
	private updateInterval: NodeJS.Timeout | undefined;

	private readonly kickApi = new KickApi();
	private readonly kickStreamers = ["furazek", "rybsonlol", "xmerghani", "niter", "mamm0n"]; //TODO change to storage system
	private readonly streamers: Signal<KickStreamerInfo[]> = signal([]);

	async initialize() {
		await this.refreshStatuses();
		if (this.updateInterval) clearInterval(this.updateInterval);
		this.updateInterval = setInterval(() => void this.refreshStatuses(), KickStreamersModule.UPDATE_INTERVAL_MS);
	}

	private mountSection(elements: Element[]) {
		if (document.querySelector(`.${this.getId()}`)) return;
		const parent = elements.at(0);
		if (!parent) return;
		const wrapper = this.commonUtils().createElementByParent(this.getId(), "div", parent);
		render(<KickStreamersSection streamers={this.streamers} onRefresh={this.refreshStatuses.bind(this)} />, wrapper);
	}

	private async refreshStatuses() {
		try {
			const results = await Promise.all(
				this.kickStreamers.map(async (name) => {
					try {
						const { data } = await this.kickApi.getChannel(name.toLowerCase());
						return this.mapChannelToInfo(data);
					} catch (error) {
						this.logger.warn(`Failed to fetch Kick channel: ${name}`, error);
						return undefined;
					}
				}),
			);
			const mapped = results.filter(Boolean) as KickStreamerInfo[];
			mapped.sort((a, b) => b.viewerCount - a.viewerCount);
			this.streamers.value = mapped;
			this.logger.info("Kick statuses updated", mapped);
		} catch (error) {
			this.logger.error("Failed to refresh Kick statuses", error);
		}
	}

	private mapChannelToInfo(channel: ChannelResponse): KickStreamerInfo {
		const isLive = Boolean(channel.livestream?.is_live);
		const category =
			channel.livestream?.categories?.[0]?.name ?? channel.livestream?.categories?.[0]?.category?.name ?? null;
		return {
			username: channel.user.username,
			isLive,
			game: category ?? null,
			avatar: channel.user.profile_pic ?? null,
			url: `https://kick.com/${channel.slug ?? channel.user.username}`,
			viewerCount: channel.livestream?.viewer_count ?? 0,
		};
	}
}

function KickStreamersSection({
	streamers,
	onRefresh,
}: {
	streamers: Signal<KickStreamerInfo[]>;
	onRefresh: () => void;
}) {
	const rootRef = useRef<HTMLDivElement>(null);
	const [compact, setCompact] = useState(false);

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
					<span>KICK</span>
					<RefreshButton onClick={onRefresh}>Refresh</RefreshButton>
				</SectionHeader>
			)}
			<List>
				{streamers.value.map((s) => (
					<Item
						key={s.username}
						$offline={!s.isLive}
						$compact={compact}
						href={s.url}
						target="_blank"
						rel="noopener noreferrer"
					>
						<Avatar $compact={compact} src={s.avatar ?? ""} alt={s.username} />
						{!compact && (
							<ItemBody>
								<Name>{String(s.username)}</Name>
								<Game>{s.game ?? ""}</Game>
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
	font-size: 12px;
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
	width: ${(props) => (props.$compact ? 32 : 24)}px;
	height: ${(props) => (props.$compact ? 32 : 24)}px;
	border-radius: 50%;
	background: #232323;
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
`;

const Game = styled.div`
	font-size: 12px;
	color: #adadb8;
`;

const RightStatus = styled.div`
	margin-left: auto;
	font-size: 12px;
	color: #adadb8;
	display: inline-flex;
	align-items: center;
	gap: 6px;
`;

const LiveDot = styled.span`
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #5ee42a;
`;

const RightViewers = styled.span`
	font-size: 13px;
	font-weight: 700;
	color: #ffffff;
`;

const formatViewers = (viewers: number) =>
	Math.abs(viewers) < 10000 ? viewers.toString() : viewers.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
