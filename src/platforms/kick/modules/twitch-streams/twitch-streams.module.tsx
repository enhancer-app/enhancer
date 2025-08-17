import KickModule from "$kick/kick.module.ts";
import TwitchApi from "$twitch/apis/twitch.api.ts";
import type { TwitchMultiChannelResponse } from "$types/platforms/twitch/twitch.api.types.ts";
import type { KickModuleConfig } from "$types/shared/module/module.types.ts";
import { type Signal, signal } from "@preact/signals";
import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import styled from "styled-components";

type TwitchStreamerInfo = {
	username: string;
	isLive: boolean;
	game: string | null;
	avatar: string | null;
	url: string;
	viewerCount: number;
};

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
	};

	private static readonly UPDATE_INTERVAL_MS = 5 * 60 * 1000;
	private updateInterval: NodeJS.Timeout | undefined;

	private readonly twitchApi = new TwitchApi({} as any);
	private readonly twitchStreamers: string[] = [];
	private cachedTwitchStreamers: string[] | null = null;
	private readonly streamers: Signal<TwitchStreamerInfo[]> = signal([]);

	async initialize() {
		await this.loadStreamersFromCommon();
		await this.refreshStatuses();
		if (this.updateInterval) clearInterval(this.updateInterval);
		this.updateInterval = setInterval(() => void this.refreshStatuses(), TwitchStreamsModule.UPDATE_INTERVAL_MS);
	}

	private mountSection(elements: Element[]) {
		if (document.querySelector(`.${this.getId()}`)) return;

		const targetElement = this.findTargetElement(elements.at(0));
		if (!targetElement) return;

		const wrapper = document.createElement("div");
		wrapper.id = this.getId();
		targetElement.parentNode?.insertBefore(wrapper, targetElement);

		render(<TwitchStreamsSection streamers={this.streamers} onRefresh={this.refreshStatuses.bind(this)} />, wrapper);
	}

	private findTargetElement(sidebarWrapper: Element | undefined): Element | null {
		if (!sidebarWrapper) return null;

		const thirdChild = sidebarWrapper.children[2];
		if (!thirdChild) return null;

		const flexContainer = thirdChild.children[0];
		if (!flexContainer) return null;

		return flexContainer.querySelector("section:nth-child(3)");
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
		return (this.cachedTwitchStreamers && this.cachedTwitchStreamers.length > 0)
			? this.cachedTwitchStreamers
			: this.twitchStreamers;
	}

	private async loadStreamersFromCommon(): Promise<void> {
		try {
			const res = await this.workerService().send("getCommon", { platform: "kick", key: "twitchStreamers" });
			const value = (res && (res as { value: unknown | null }).value) as unknown;
			if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
				this.cachedTwitchStreamers = value as string[];
			} else {
				this.cachedTwitchStreamers = [];
			}
			this.logger.debug("Loaded Twitch streamer nicknames for Kick:", this.cachedTwitchStreamers);
		} catch (error) {
			this.logger.warn("Failed to load Twitch streamers from common store", error);
			this.cachedTwitchStreamers = [];
		}
	}

	private async refreshStatuses() {
		try {
			await this.loadStreamersFromCommon();
			const source = this.getStreamerNames();
			if (source.length === 0) {
				this.streamers.value = [];
				return;
			}
			const query = this.buildMultiChannelQuery(source.map((n) => n.toLowerCase()));
			const { data } = await this.twitchApi.gql<TwitchMultiChannelResponse>(query, {} as any);
			const mapped: TwitchStreamerInfo[] = source.map((name, idx) => {
				const node = data?.[`a${idx}` as const];
				const isLive = Boolean(node?.stream);
				return {
					username: (node?.displayName as string) ?? name,
					isLive,
					game: (node?.stream?.game?.name as string) ?? null,
					avatar: (node?.owner?.profileImageURL as string) ?? null,
					url: `https://twitch.tv/${name}`,
					viewerCount: (node?.stream?.viewersCount as number) ?? 0,
				};
			});
			mapped.sort((a, b) => b.viewerCount - a.viewerCount);
			this.streamers.value = mapped;
			this.logger.info("Twitch statuses updated", mapped);
		} catch (error) {
			this.logger.error("Failed to refresh Twitch statuses", error);
		}
	}
}

function TwitchStreamsSection({
	streamers,
	onRefresh,
}: {
	streamers: Signal<TwitchStreamerInfo[]>;
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
		<SectionWrapper ref={rootRef} className="twitch-streams-section">
			{!compact && (
				<SectionHeader>
					<span>TWITCH</span>
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
    background: #eb0400; 
`;

const RightViewers = styled.span`
	font-size: 13px;
	font-weight: 700;
	color: #ffffff;
`;

const formatViewers = (viewers: number) =>
	Math.abs(viewers) < 10000 ? viewers.toString() : viewers.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
