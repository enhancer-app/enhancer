import { MarqueeTextComponent } from "$shared/components/marquee-text/marquee-text.component.tsx";
import {
	channelThumbnailUrl,
	formatAgo,
	formatViewers,
	getFollowsComparator,
	getFollowsSortOptions,
	getVisibleProblem,
	PinIcon,
	PLATFORM_COLORS,
	PLATFORM_NAMES,
	PLATFORM_URLS,
	PlatformLabel,
} from "$shared/components/cross-platform-follows/platform.shared.tsx";
import { SortMenuComponent } from "$shared/components/sort-menu/sort-menu.component.tsx";
import { StreamPreviewComponent } from "$shared/components/stream-preview/stream-preview.component.tsx";
import { TooltipComponent } from "$shared/components/tooltip/tooltip.component.tsx";
import { getPlaylistFetcher } from "$shared/utils/playlist-proxy.utils.ts";
import { FLIP_KEY_ATTRIBUTE, useBecameTrue, useFlipAnimation } from "$shared/utils/flip-animation.utils.ts";
import { FOLLOWS_SORT_LABELS } from "$shared/utils/follows-sort.utils.ts";
import type {
	CrossPlatformFollowsComponentProps,
	SidebarChannel,
	SidebarChannelRowProps,
} from "$types/shared/components/cross-platform-follows.component.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type {
	CrossPlatformFollowsSnapshot,
	FollowsSortOrder,
} from "$types/shared/worker/cross-platform-follows-worker.types.ts";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import styled, { css, keyframes } from "styled-components";

const REFRESH_INTERVAL_MS = 60_000;
const COLLAPSED_COUNT = 10;
const COMPACT_WIDTH = 120;
const PLATFORM_SITES: Record<PlatformType, string> = { twitch: "twitch.tv", kick: "kick.com" };
const PLATFORMS: PlatformType[] = ["twitch", "kick"];

export function CrossPlatformFollowsComponent({
	hostPlatform,
	workerService,
	title,
	pinsEnabled,
	sort: savedSort,
	onSortChange,
	onNavigate,
}: CrossPlatformFollowsComponentProps) {
	const [snapshots, setSnapshots] = useState<Partial<Record<PlatformType, CrossPlatformFollowsSnapshot>>>({});
	const [pages, setPages] = useState(1);
	const [sort, setSort] = useState<FollowsSortOrder>(savedSort);
	const [compact, setCompact] = useState(false);
	const [now, setNow] = useState(() => Date.now());
	const containerRef = useRef<HTMLDivElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const sourcePlatform: PlatformType = hostPlatform === "twitch" ? "kick" : "twitch";

	useEffect(() => {
		let disposed = false;

		const load = async () => {
			if (document.visibilityState !== "visible") return;
			const results = await Promise.all(
				PLATFORMS.map((platform) => workerService.send("getFollowsStatus", { platform, refresh: true })),
			);
			if (disposed) return;
			setSnapshots((previous) => {
				const next = { ...previous };
				results.forEach((snapshot, index) => {
					if (snapshot) next[PLATFORMS[index]] = snapshot;
				});
				return next;
			});
			setNow(Date.now());
		};
		const handleBroadcast = (payload: CrossPlatformFollowsSnapshot) => {
			if (disposed) return;
			setSnapshots((previous) => ({ ...previous, [payload.platform]: payload }));
			setNow(Date.now());
		};
		const handleVisibility = () => void load();
		workerService.onBroadcast("cross-platform-follows-updated", handleBroadcast);
		document.addEventListener("visibilitychange", handleVisibility);
		const interval = window.setInterval(() => void load(), REFRESH_INTERVAL_MS);
		void load();

		return () => {
			disposed = true;
			window.clearInterval(interval);
			document.removeEventListener("visibilitychange", handleVisibility);
			workerService.offBroadcast("cross-platform-follows-updated", handleBroadcast);
		};
	}, [workerService]);

	useEffect(() => setSort(savedSort), [savedSort]);

	useEffect(() => {
		const element = containerRef.current;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) => setCompact(entry.contentRect.width < COMPACT_WIDTH));
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	const hostSnapshot = snapshots[hostPlatform];
	const sourceSnapshot = snapshots[sourcePlatform];

	const unsorted = useMemo(() => {
		const list: SidebarChannel[] = [];
		for (const snapshot of [hostSnapshot, sourceSnapshot]) {
			for (const channel of snapshot?.channels ?? []) {
				list.push({ ...channel, pinned: pinsEnabled && channel.pinned, platform: snapshot!.platform });
			}
		}
		return list;
	}, [hostSnapshot, sourceSnapshot, pinsEnabled]);
	const sortOptions = getFollowsSortOptions(unsorted);
	const activeSort = sortOptions.includes(sort) ? sort : "viewers-desc";
	const channels = useMemo(
		() => [...unsorted].sort(getFollowsComparator(activeSort, now)),
		[unsorted, activeSort, now],
	);

	const changeSort = (option: FollowsSortOrder) => {
		setSort(option);
		onSortChange(option);
	};

	const pinnedCount = channels.filter((channel) => channel.pinned).length;
	const visible = compact
		? channels.filter((channel) => channel.live)
		: channels.slice(0, Math.max(COLLAPSED_COUNT * pages, pinnedCount));
	useFlipAnimation(
		listRef,
		visible.map((channel) => `${channel.platform}:${channel.login}`),
	);
	const notices: string[] = [];
	if (!hostSnapshot?.synced) notices.push(`Loading your ${PLATFORM_NAMES[hostPlatform]} follows…`);
	if (sourceSnapshot && !sourceSnapshot.synced) {
		notices.push(
			`Open ${PLATFORM_SITES[sourcePlatform]} once while logged in to load your ${PLATFORM_NAMES[sourcePlatform]} follows.`,
		);
	}
	if ([hostSnapshot, sourceSnapshot].some((snapshot) => getVisibleProblem(snapshot) === "session-missing")) {
		notices.push("Open kick.com while logged in to refresh live status.");
	}

	const stale = [hostSnapshot, sourceSnapshot].some((snapshot) => getVisibleProblem(snapshot));
	const staleText = stale ? "Couldn't refresh live status. Showing the last known state." : null;

	const resolvePreviewUrl = useCallback(
		async (platform: PlatformType, login: string) =>
			(await workerService.send("getStreamPlaybackUrl", { platform, login }))?.url ?? null,
		[workerService],
	);

	const togglePin = (channel: SidebarChannel) => {
		const pinned = !channel.pinned;
		setSnapshots((previous) => {
			const snapshot = previous[channel.platform];
			if (!snapshot) return previous;
			const updated = snapshot.channels.map((item) => (item.login === channel.login ? { ...item, pinned } : item));
			return { ...previous, [channel.platform]: { ...snapshot, channels: updated } };
		});
		void workerService.send("setChannelPinned", { platform: channel.platform, login: channel.login, pinned });
	};

	return (
		<Container ref={containerRef} $host={hostPlatform} $compact={compact}>
			<Header $host={hostPlatform} $compact={compact}>
				{!compact && <HeaderTitle>{title ?? "Followed Channels"}</HeaderTitle>}
				{!compact && staleText && (
					<TooltipComponent content={staleText} position="top">
						<StaleBadge>!</StaleBadge>
					</TooltipComponent>
				)}
				{!compact && unsorted.length > 0 && (
					<TooltipComponent content={`Sort: ${FOLLOWS_SORT_LABELS[activeSort]}`} position="right">
						<SortControl $host={hostPlatform}>
							<SortMenuComponent
								value={activeSort}
								options={sortOptions}
								labels={FOLLOWS_SORT_LABELS}
								onChange={changeSort}
								theme={hostPlatform}
								label="Sort followed channels"
								renderTrigger={() => (
									<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
										<path
											d="M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										/>
									</svg>
								)}
							/>
						</SortControl>
					</TooltipComponent>
				)}
			</Header>
			{!compact &&
				notices.map((notice) => (
					<Notice key={notice} $host={hostPlatform}>
						{notice}
					</Notice>
				))}
			<List ref={listRef}>
				{visible.map((channel) => (
					<ChannelRow
						key={`${channel.platform}:${channel.login}`}
						channel={channel}
						host={hostPlatform}
						compact={compact}
						now={now}
						onTogglePin={pinsEnabled ? togglePin : undefined}
						onNavigate={onNavigate}
						resolvePreviewUrl={resolvePreviewUrl}
					/>
				))}
			</List>
			{!compact && (channels.length > visible.length || pages > 1) && (
				<ToggleRow>
					{channels.length > visible.length && (
						<ToggleButton $host={hostPlatform} onClick={() => setPages(pages + 1)}>
							Show more
						</ToggleButton>
					)}
					{pages > 1 && (
						<ToggleButton $host={hostPlatform} $end onClick={() => setPages(1)}>
							Show less
						</ToggleButton>
					)}
				</ToggleRow>
			)}
		</Container>
	);
}

function ChannelRow({
	channel,
	host,
	compact,
	now,
	onTogglePin,
	onNavigate,
	resolvePreviewUrl,
}: SidebarChannelRowProps) {
	const [hovered, setHovered] = useState(false);
	const [previewPlaying, setPreviewPlaying] = useState(false);
	const [previewFailed, setPreviewFailed] = useState(false);
	const wentLive = useBecameTrue(channel.live);
	const url = PLATFORM_URLS[channel.platform](channel.login);
	const subtitle = channel.live
		? (channel.category ?? channel.title ?? "Live")
		: channel.lastLiveAt
			? `Live ${formatAgo(channel.lastLiveAt, now)}`
			: "Offline";
	const thumbnail = channel.live ? channelThumbnailUrl(channel.platform, channel, now) : null;

	const tooltip = (
		<TooltipContent>
			{channel.live && (
				<TooltipPreview>
					{thumbnail && <img src={thumbnail} alt="" />}
					<StreamPreviewComponent
						platform={channel.platform}
						login={channel.login}
						resolveUrl={resolvePreviewUrl}
						onPlaying={() => setPreviewPlaying(true)}
						onFailed={() => setPreviewFailed(true)}
						playlistFetcher={getPlaylistFetcher(channel.platform)}
					/>
					{!previewPlaying && !previewFailed && <TooltipPreviewLoader />}
				</TooltipPreview>
			)}
			<TooltipHeading>
				<strong>{channel.displayName}</strong>
				<PlatformLabel platform={channel.platform} />
			</TooltipHeading>
			{channel.live && channel.title && <TooltipTitle>{channel.title}</TooltipTitle>}
			{channel.live ? (
				<TooltipMeta>
					<span>{channel.category ?? "Live"}</span>
					<TooltipViewers>{formatViewers(channel.viewers)} viewers</TooltipViewers>
				</TooltipMeta>
			) : (
				<TooltipMeta>{subtitle}</TooltipMeta>
			)}
		</TooltipContent>
	);

	const handleClick = (event: MouseEvent) => {
		if (channel.platform !== host || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return;
		event.preventDefault();
		onNavigate(url);
	};

	const handlePin = (event: MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		onTogglePin?.(channel);
	};

	const row = (
		<Row
			key={wentLive}
			href={url}
			onClick={handleClick}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => {
				setHovered(false);
				setPreviewPlaying(false);
				setPreviewFailed(false);
			}}
			{...{ [FLIP_KEY_ATTRIBUTE]: `${channel.platform}:${channel.login}` }}
			$host={host}
			$compact={compact}
			$live={channel.live}
			$wentLive={wentLive > 0}
		>
			<Avatar $host={host} $live={channel.live}>
				{channel.avatarUrl ? <img src={channel.avatarUrl} alt="" loading="lazy" /> : <AvatarFallback />}
				{compact && channel.live && <CompactLiveDot $host={host} />}
				<PlatformDot $host={host} $platform={channel.platform} title={PLATFORM_NAMES[channel.platform]} />
				{!compact && onTogglePin && (
					<PinButton
						role="button"
						aria-label={channel.pinned ? "Unpin channel" : "Pin channel"}
						title={channel.pinned ? "Unpin channel" : "Pin channel"}
						$host={host}
						$pinned={channel.pinned}
						onClick={handlePin}
					>
						<PinIcon filled={channel.pinned} size={12} />
					</PinButton>
				)}
			</Avatar>
			{!compact && (
				<>
					<Meta>
						<Name $host={host}>{channel.displayName}</Name>
						<Subtitle $host={host}>
							<MarqueeTextComponent text={subtitle} active={hovered} />
						</Subtitle>
					</Meta>
					{channel.live && (
						<Viewers $host={host}>
							<LiveDot $host={host} />
							{formatViewers(channel.viewers)}
						</Viewers>
					)}
				</>
			)}
		</Row>
	);

	return (
		<TooltipComponent content={tooltip} position="right" delay={400}>
			{row}
		</TooltipComponent>
	);
}

type HostProps = { $host: PlatformType };

const Container = styled.div<HostProps & { $compact: boolean }>`
	display: flex;
	flex-direction: column;
	width: 100%;
	box-sizing: border-box;
	font-family: inherit;

	${({ $host, $compact }) =>
		$host === "kick"
			? css`
					gap: 8px;
					padding: ${$compact ? "12px 4px" : "12px"};
				`
			: css`
					padding: ${$compact ? "8px 0" : "8px 0 4px"};
				`}
`;

const Header = styled.div<HostProps & { $compact: boolean }>`
	display: flex;
	align-items: center;
	gap: 6px;
	justify-content: ${({ $compact }) => ($compact ? "center" : "flex-start")};

	${({ $host, $compact }) =>
		$host === "kick"
			? css`
					height: 36px;
					padding: ${$compact ? "0 6px" : "0 0 0 6px"};
					font-size: 16px;
					font-weight: 600;
					color: #fff;
				`
			: css`
					padding: ${$compact ? "5px 8px" : "5px 0 5px 8px"};
					font-size: 14px;
					font-weight: 600;
					color: var(--color-text-base);
				`}
`;

const HeaderTitle = styled.span`
	flex: 1;
	display: flex;
	align-items: baseline;
	gap: 6px;
	min-width: 0;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
`;

const StaleBadge = styled.span`
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 14px;
	height: 14px;
	border-radius: 50%;
	background: #ff4757;
	color: #fff;
	font-size: 10px;
	font-weight: 700;
	cursor: help;
`;

const SortControl = styled.span<HostProps>`
	display: inline-flex;

	> button {
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: ${({ $host }) => ($host === "kick" ? "6px" : "var(--border-radius-medium)")};
		color: ${({ $host }) => ($host === "kick" ? "rgba(255, 255, 255, 0.6)" : "var(--color-text-alt-2)")};
	}

	> button:hover,
	> button:focus-visible,
	> button[data-open] {
		color: ${({ $host }) => ($host === "kick" ? "#fff" : "var(--color-text-base)")};
		background: ${({ $host }) =>
			$host === "kick" ? "rgba(255, 255, 255, 0.08)" : "var(--color-background-button-text-hover)"};
	}
`;

const Notice = styled.p<HostProps>`
	margin: 0;
	font-size: 12px;
	line-height: 1.4;
	padding: ${({ $host }) => ($host === "kick" ? "0 6px" : "2px 8px 6px")};
	color: ${({ $host }) => ($host === "kick" ? "rgba(255, 255, 255, 0.6)" : "var(--color-text-alt-2)")};
`;

const List = styled.div`
	display: flex;
	flex-direction: column;

	& > div {
		display: block;
		width: 100%;
	}
`;

const Row = styled.a<HostProps & { $compact: boolean; $live: boolean; $wentLive: boolean }>`
	display: flex;
	${({ $wentLive, $host }) =>
		$wentLive &&
		css`
			animation: ${$host === "kick" ? kickLiveFlash : twitchLiveFlash} 1.6s ease-out;
		`}
	align-items: center;
	gap: 10px;
	text-decoration: none !important;
	color: inherit !important;
	box-sizing: border-box;
	justify-content: ${({ $compact }) => ($compact ? "center" : "flex-start")};

	${({ $host, $compact }) =>
		$host === "kick"
			? css`
					height: 44px;
					gap: 8px;
					padding: 0 ${$compact ? "0" : "6px"};
					border-radius: 4px;
					&:hover {
						background: rgba(255, 255, 255, 0.08);
					}
					&:hover [role="button"] {
						opacity: 1;
					}
				`
			: css`
					height: 45px;
					padding: 5px ${$compact ? "4px" : "8px"};
					border-radius: 4px;
					justify-content: flex-start;
					&:hover {
						background: var(--color-background-interactable-hover);
					}
					&:hover [role="button"] {
						opacity: 1;
					}
				`}

	${({ $live }) =>
		!$live &&
		css`
			& > div {
				opacity: 0.6;
			}
		`}
`;

const Avatar = styled.div<HostProps & { $live: boolean }>`
	position: relative;
	flex-shrink: 0;
	width: ${({ $host }) => ($host === "kick" ? "32px" : "30px")};
	height: ${({ $host }) => ($host === "kick" ? "32px" : "30px")};

	img {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		object-fit: cover;
		filter: ${({ $live }) => ($live ? "none" : "grayscale(1)")};
	}
`;

const AvatarFallback = styled.div`
	width: 100%;
	height: 100%;
	border-radius: 50%;
	background: #232323;
`;

const Meta = styled.div`
	display: flex;
	flex-direction: column;
	flex: 1;
	min-width: 0;
	gap: 2px;
`;

const Name = styled.span<HostProps>`
	font-size: 14px;
	font-weight: ${({ $host }) => ($host === "kick" ? 700 : 600)};
	line-height: 1.2;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	color: ${({ $host }) => ($host === "kick" ? "#fff" : "var(--color-text-base)")};
`;

const Subtitle = styled.span<HostProps>`
	font-size: ${({ $host }) => ($host === "kick" ? "14px" : "13px")};
	line-height: 1.2;
	min-width: 0;
	color: ${({ $host }) => ($host === "kick" ? "rgba(255, 255, 255, 0.6)" : "var(--color-text-alt-2)")};
`;

const Viewers = styled.span<HostProps>`
	display: flex;
	align-items: center;
	gap: 5px;
	flex-shrink: 0;
	align-self: flex-start;
	font-size: ${({ $host }) => ($host === "kick" ? "14px" : "13px")};
	font-weight: ${({ $host }) => ($host === "kick" ? 600 : 400)};
	color: ${({ $host }) => ($host === "kick" ? "#fff" : "var(--color-text-alt)")};
`;

const LiveDot = styled.span<HostProps>`
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: ${({ $host }) => ($host === "kick" ? "#53fc18" : "#eb0400")};
`;

const CompactLiveDot = styled(LiveDot)`
	position: absolute;
	right: -1px;
	top: -1px;
	border: 2px solid ${({ $host }) => ($host === "kick" ? "#0b0e0f" : "var(--color-background-alt)")};
`;

const ToggleRow = styled.div`
	display: flex;
	align-items: center;
`;

const ToggleButton = styled.button<HostProps & { $end?: boolean }>`
	margin-left: ${({ $end }) => ($end ? "auto" : "0")};
	background: none;
	border: none;
	cursor: pointer;
	font-size: 13px;
	font-weight: 600;
	padding: ${({ $host }) => ($host === "kick" ? "4px 6px" : "5px 8px")};
	color: ${({ $host }) => ($host === "kick" ? "#53fc18" : "var(--color-text-link)")};

	&:hover {
		text-decoration: underline;
	}
`;

const TooltipContent = styled.div`
	display: flex;
	flex-direction: column;
	gap: 3px;
	max-width: 260px;
	white-space: normal;
`;

const TooltipHeading = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;

	strong {
		min-width: 0;
		overflow: hidden;
		color: #fff;
		font-size: 14px;
		font-weight: 700;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
`;

const TooltipTitle = styled.span`
	display: -webkit-box;
	overflow: hidden;
	color: #dedee3;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
`;

const TooltipMeta = styled.span`
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 6px;
	color: #adadb8;
	font-size: 12px;
`;

const TooltipViewers = styled.span`
	display: inline-flex;
	align-items: center;
	gap: 5px;
	color: #dedee3;

	&::before {
		content: "";
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #eb0400;
	}
`;

const PlatformDot = styled.span<HostProps & { $platform: PlatformType }>`
	position: absolute;
	right: -3px;
	bottom: -3px;
	box-sizing: border-box;
	width: 12px;
	height: 12px;
	border-radius: 50%;
	background: ${({ $platform }) => PLATFORM_COLORS[$platform]};
	border: 2px solid ${({ $host }) => ($host === "kick" ? "#090b0f" : "var(--color-background-base)")};
`;

const PIN_COLORS: Record<PlatformType, { icon: string; background: string; hover: string }> = {
	twitch: { icon: "white", background: "rgba(145, 71, 255, 0.5)", hover: "rgba(145, 71, 255, 0.7)" },
	kick: { icon: "white", background: "rgba(140, 255, 100, 0.6)", hover: "rgba(140, 255, 100, 0.8)" },
};

const PinButton = styled.span<HostProps & { $pinned: boolean }>`
	position: absolute;
	left: -4px;
	bottom: -6px;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 16px;
	height: 16px;
	border-radius: 3px;
	cursor: pointer;
	color: ${({ $host, $pinned }) => ($pinned ? PIN_COLORS[$host].icon : "white")};
	background: ${({ $host, $pinned }) => ($pinned ? PIN_COLORS[$host].background : "rgba(0, 0, 0, 0.4)")};
	opacity: ${({ $pinned }) => ($pinned ? 1 : 0)};
	transition: all 0.2s ease;

	&:hover {
		background: ${({ $host, $pinned }) => ($pinned ? PIN_COLORS[$host].hover : "rgba(0, 0, 0, 0.6)")};
		transform: scale(1.05);
	}
`;

const twitchLiveFlash = keyframes`
	0% { background: rgba(145, 71, 255, 0.45); }
	100% { background: transparent; }
`;

const kickLiveFlash = keyframes`
	0% { background: rgba(83, 252, 24, 0.25); }
	100% { background: transparent; }
`;

const previewSpin = keyframes`
	to { transform: rotate(360deg); }
`;

const TooltipPreview = styled.div`
	position: relative;
	width: 260px;
	aspect-ratio: 16 / 9;
	margin-bottom: 6px;
	overflow: hidden;
	border-radius: 6px;
	background: #161616;

	img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
`;

const TooltipPreviewLoader = styled.span`
	position: absolute;
	top: calc(50% - 11px);
	left: calc(50% - 11px);
	width: 22px;
	height: 22px;
	border: 3px solid rgba(255, 255, 255, 0.25);
	border-top-color: white;
	border-radius: 50%;
	animation: ${previewSpin} 0.8s linear infinite;
`;
