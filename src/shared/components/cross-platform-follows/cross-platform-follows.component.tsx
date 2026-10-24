import { MarqueeTextComponent } from "$shared/components/marquee-text/marquee-text.component.tsx";
import {
	formatAgo,
	formatViewers,
	getFollowsComparator,
	getFollowsSortOptions,
	getVisibleProblem,
	LinkedPlatformIcon,
	PinIcon,
	PLATFORM_COLORS,
	PLATFORM_NAMES,
	PLATFORM_URLS,
} from "$shared/components/cross-platform-follows/platform.shared.tsx";
import { filterFollowsByPlatform } from "$shared/utils/follows-filter.utils.ts";
import { PlatformFilterComponent } from "$shared/components/platform-filter/platform-filter.component.tsx";
import { filterFollowsBySearch } from "$shared/utils/follows-search.utils.ts";
import { SortMenuComponent } from "$shared/components/sort-menu/sort-menu.component.tsx";
import { TooltipComponent } from "$shared/components/tooltip/tooltip.component.tsx";
import { ChannelTooltipContent } from "$shared/components/cross-platform-follows/channel-tooltip.component.tsx";
import { FLIP_KEY_ATTRIBUTE, useBecameTrue, useFlipAnimation } from "$shared/utils/flip-animation.utils.ts";
import { FOLLOWS_SORT_LABELS } from "$shared/utils/follows-sort.utils.ts";
import { getFollowEntryKey, getPinTargets, mergeLinkedChannels } from "$shared/utils/follows-links.utils.ts";
import { useChannelLinks } from "$shared/utils/channel-links.utils.ts";
import { getFollowsStatusState } from "$shared/utils/follows-freshness.utils.ts";
import {
	ChannelContextMenu,
	LinkChannelDialog,
} from "$shared/components/cross-platform-follows/link-channel.component.tsx";
import type {
	ChannelMenuState,
	CrossPlatformFollowsComponentProps,
	SidebarChannel,
	SidebarChannelRowProps,
} from "$types/shared/components/cross-platform-follows.component.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { ChannelLinksAction, ChannelLinksTransport } from "$types/shared/utils/channel-links.types.ts";
import type {
	CrossPlatformFollowsSnapshot,
	FollowsPlatformFilter,
	FollowsSortOrder,
} from "$types/shared/worker/cross-platform-follows-worker.types.ts";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import styled, { css, keyframes } from "styled-components";

const REFRESH_INTERVAL_MS = 60_000;
const WAKE_CHECK_MS = 5_000;
const WAKE_GAP_MS = 20_000;
const RESUME_EVENTS = ["online", "focus", "pageshow"] as const;
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
	platformFilter: savedPlatformFilter,
	onPlatformFilterChange,
	onNavigate,
}: CrossPlatformFollowsComponentProps) {
	const linksTransport = useMemo<ChannelLinksTransport>(
		() => ({
			send: (action, payload) => workerService.send<ChannelLinksAction>(action, payload),
			subscribe: (handler) => {
				workerService.onBroadcast("channel-links-updated", handler);
				return () => workerService.offBroadcast("channel-links-updated", handler);
			},
		}),
		[workerService],
	);
	const channelLinks = useChannelLinks(linksTransport);
	const { links } = channelLinks;
	const [menu, setMenu] = useState<ChannelMenuState | null>(null);
	const [linking, setLinking] = useState<SidebarChannel | null>(null);
	const [snapshots, setSnapshots] = useState<Partial<Record<PlatformType, CrossPlatformFollowsSnapshot>>>({});
	const [pages, setPages] = useState(1);
	const [sort, setSort] = useState<FollowsSortOrder>(savedSort);
	const [platformFilter, setPlatformFilter] = useState<FollowsPlatformFilter>(savedPlatformFilter);
	const [compact, setCompact] = useState(false);
	const [searchOpen, setSearchOpen] = useState(false);
	const [searchMinHeight, setSearchMinHeight] = useState(0);
	const [query, setQuery] = useState("");
	const [now, setNow] = useState(() => Date.now());
	const containerRef = useRef<HTMLDivElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const searchButtonRef = useRef<HTMLButtonElement>(null);
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
		const handleResume = () => void load();
		let lastTick = Date.now();
		const detectWake = () => {
			const tick = Date.now();
			if (tick - lastTick > WAKE_GAP_MS) void load();
			lastTick = tick;
		};
		workerService.onBroadcast("cross-platform-follows-updated", handleBroadcast);
		document.addEventListener("visibilitychange", handleResume);
		for (const event of RESUME_EVENTS) window.addEventListener(event, handleResume);
		const interval = window.setInterval(() => void load(), REFRESH_INTERVAL_MS);
		const wakeInterval = window.setInterval(detectWake, WAKE_CHECK_MS);
		void load();

		return () => {
			disposed = true;
			window.clearInterval(interval);
			window.clearInterval(wakeInterval);
			document.removeEventListener("visibilitychange", handleResume);
			for (const event of RESUME_EVENTS) window.removeEventListener(event, handleResume);
			workerService.offBroadcast("cross-platform-follows-updated", handleBroadcast);
		};
	}, [workerService]);

	useEffect(() => setSort(savedSort), [savedSort]);

	useEffect(() => setPlatformFilter(savedPlatformFilter), [savedPlatformFilter]);

	useEffect(() => {
		const element = containerRef.current;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) => setCompact(entry.contentRect.width < COMPACT_WIDTH));
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	const hostSnapshot = snapshots[hostPlatform];
	const sourceSnapshot = snapshots[sourcePlatform];

	const hostStatus = getFollowsStatusState(hostSnapshot, now);
	const sourceStatus = getFollowsStatusState(sourceSnapshot, now);
	const unsorted = useMemo(() => {
		const list: SidebarChannel[] = [];
		for (const [snapshot, status] of [
			[hostSnapshot, hostStatus],
			[sourceSnapshot, sourceStatus],
		] as const) {
			for (const channel of snapshot?.channels ?? []) {
				list.push({
					...channel,
					pinned: pinsEnabled && channel.pinned,
					platform: snapshot!.platform,
					stale: status !== "fresh",
				});
			}
		}
		return mergeLinkedChannels(list, links);
	}, [hostSnapshot, sourceSnapshot, hostStatus, sourceStatus, pinsEnabled, links]);
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

	const changePlatformFilter = (option: FollowsPlatformFilter) => {
		if (option === platformFilter) return;
		setPlatformFilter(option);
		setPages(1);
		onPlatformFilterChange(option);
	};

	const closeSearch = () => {
		setSearchOpen(false);
		setQuery("");
	};

	const toggleSearch = () => {
		if (searchOpen) return closeSearch();
		setSearchMinHeight(containerRef.current?.offsetHeight ?? 0);
		setSearchOpen(true);
	};

	const handleSearchKeyDown = (event: KeyboardEvent) => {
		event.stopPropagation();
		if (event.key !== "Escape") return;
		event.preventDefault();
		closeSearch();
		searchButtonRef.current?.focus();
	};

	useEffect(() => {
		if (searchOpen) searchInputRef.current?.focus();
	}, [searchOpen]);

	const searching = searchOpen && !compact && query.trim() !== "";
	const platformFiltered = useMemo(() => filterFollowsByPlatform(channels, platformFilter), [channels, platformFilter]);
	const filtered = useMemo(
		() => (searching ? filterFollowsBySearch(platformFiltered, query) : platformFiltered),
		[platformFiltered, searching, query],
	);
	const pinnedCount = filtered.filter((channel) => channel.pinned).length;
	const visible = compact
		? channels.filter((channel) => channel.live)
		: searching
			? filtered
			: filtered.slice(0, Math.max(COLLAPSED_COUNT * pages, pinnedCount));
	const emptyFilterText =
		platformFilter !== "all" && platformFiltered.length === 0 && snapshots[platformFilter]?.synced
			? `You don't follow anyone on ${PLATFORM_NAMES[platformFilter]} yet.`
			: searching && filtered.length === 0
				? `No followed channels match "${query.trim()}".`
				: null;
	useFlipAnimation(
		listRef,
		visible.map((channel) => getFollowEntryKey(channel)),
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

	const failed =
		[hostStatus, sourceStatus].includes("failed") ||
		[hostSnapshot, sourceSnapshot].some((snapshot) => getVisibleProblem(snapshot));
	const updating = !failed && [hostStatus, sourceStatus].includes("updating");
	const staleText = failed ? "Couldn't refresh live status. Showing the last known state." : null;

	const resolvePreviewUrl = useCallback(
		async (platform: PlatformType, login: string) =>
			(await workerService.send("getStreamPlaybackUrl", { platform, login }))?.url ?? null,
		[workerService],
	);

	const togglePin = (channel: SidebarChannel) => {
		const pinned = !channel.pinned;
		const targets = getPinTargets(channel);
		setSnapshots((previous) => {
			const next = { ...previous };
			for (const target of targets) {
				const snapshot = next[target.platform];
				if (!snapshot) continue;
				const updated = snapshot.channels.map((item) => (item.login === target.login ? { ...item, pinned } : item));
				next[target.platform] = { ...snapshot, channels: updated };
			}
			return next;
		});
		for (const target of targets) {
			void workerService.send("setChannelPinned", { platform: target.platform, login: target.login, pinned });
		}
	};

	const linkChannels = (source: SidebarChannel, target: SidebarChannel, primary: PlatformType) => {
		channelLinks.link(source, target, primary);
		setLinking(null);
	};

	const openMenu = (event: MouseEvent, channel: SidebarChannel) =>
		setMenu({ channel, anchor: event.currentTarget as Element, x: event.clientX, y: event.clientY });

	return (
		<Container
			ref={containerRef}
			$host={hostPlatform}
			$compact={compact}
			style={searchOpen && !compact ? { minHeight: `${searchMinHeight}px` } : undefined}
		>
			<Header $host={hostPlatform} $compact={compact}>
				{compact && hostPlatform === "kick" && (
					<svg width="16" height="16" viewBox="0 0 20 20" aria-label={title ?? "Followed Channels"}>
						<path
							fill="currentColor"
							d="M17.8 3.87a5.1 5.1 0 0 0-7.22 0l-.58.59-.58-.59a5.07 5.07 0 0 0-7.21 0c-2 2-2 5.22 0 7.21l6.6 6.75c.65.67 1.72.67 2.38 0l6.6-6.75a5.1 5.1 0 0 0 0-7.2"
						/>
					</svg>
				)}
				{!compact && unsorted.length > 0 && (
					<PlatformFilterComponent value={platformFilter} onChange={changePlatformFilter} theme={hostPlatform}>
						<TooltipComponent content={searchOpen ? "Close search" : "Search channels"} position="top">
							<HeaderButton
								ref={searchButtonRef}
								type="button"
								aria-label={searchOpen ? "Close search" : "Search followed channels"}
								aria-expanded={searchOpen}
								data-open={searchOpen || undefined}
								$host={hostPlatform}
								onClick={toggleSearch}
							>
								<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
									<path
										d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-4.35-4.35"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
							</HeaderButton>
						</TooltipComponent>
					</PlatformFilterComponent>
				)}
				{!compact && unsorted.length === 0 && <HeaderTitle>{title ?? "Followed Channels"}</HeaderTitle>}
				{!compact && staleText && (
					<TooltipComponent content={staleText} position="top">
						<StaleBadge>!</StaleBadge>
					</TooltipComponent>
				)}
				{!compact && updating && (
					<TooltipComponent content="Updating live status…" position="top">
						<UpdatingSpinner role="status" aria-label="Updating live status" $host={hostPlatform} />
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
			{!compact && searchOpen && unsorted.length > 0 && (
				<SearchRow $host={hostPlatform}>
					<SearchInput
						ref={searchInputRef}
						type="search"
						value={query}
						placeholder="Search channels"
						aria-label="Search followed channels"
						autoComplete="off"
						spellcheck={false}
						$host={hostPlatform}
						onInput={(event: Event) => setQuery((event.currentTarget as HTMLInputElement).value)}
						onKeyDown={handleSearchKeyDown}
						onKeyUp={(event: KeyboardEvent) => event.stopPropagation()}
						onKeyPress={(event: KeyboardEvent) => event.stopPropagation()}
					/>
				</SearchRow>
			)}
			{!compact &&
				notices.map((notice) => (
					<Notice key={notice} $host={hostPlatform}>
						{notice}
					</Notice>
				))}
			{!compact && emptyFilterText && <Notice $host={hostPlatform}>{emptyFilterText}</Notice>}
			<List ref={listRef} $spaced={compact && hostPlatform === "kick"}>
				{visible.map((channel) => (
					<ChannelRow
						key={getFollowEntryKey(channel)}
						channel={channel}
						host={hostPlatform}
						compact={compact}
						now={now}
						onTogglePin={pinsEnabled ? togglePin : undefined}
						onContextMenu={compact ? undefined : openMenu}
						onNavigate={onNavigate}
						resolvePreviewUrl={resolvePreviewUrl}
					/>
				))}
			</List>
			{!compact && !searching && (filtered.length > visible.length || pages > 1) && (
				<ToggleRow>
					{filtered.length > visible.length && (
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
			{menu && (
				<ChannelContextMenu
					{...menu}
					host={hostPlatform}
					pinsEnabled={pinsEnabled}
					onTogglePin={togglePin}
					onLink={setLinking}
					onPrefer={channelLinks.prefer}
					onUnlink={channelLinks.unlink}
					onClose={() => setMenu(null)}
				/>
			)}
			{linking && (
				<LinkChannelDialog
					channel={linking}
					channels={unsorted}
					host={hostPlatform}
					onLink={(target, primary) => linkChannels(linking, target, primary)}
					onClose={() => setLinking(null)}
				/>
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
	onContextMenu,
	onNavigate,
	resolvePreviewUrl,
}: SidebarChannelRowProps) {
	const [hovered, setHovered] = useState(false);
	const wentLive = useBecameTrue(channel.live);
	const url = PLATFORM_URLS[channel.platform](channel.login);
	const subtitle = channel.live
		? (channel.category ?? channel.title ?? "Live")
		: channel.lastLiveAt
			? `Live ${formatAgo(channel.lastLiveAt, now)}`
			: "Offline";
	const tooltip = <ChannelTooltipContent channel={channel} now={now} resolvePreviewUrl={resolvePreviewUrl} />;

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
			onContextMenu={(event: MouseEvent) => {
				if (!onContextMenu || event.shiftKey) return;
				event.preventDefault();
				onContextMenu(event, channel);
			}}
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			{...{ [FLIP_KEY_ATTRIBUTE]: getFollowEntryKey(channel) }}
			$host={host}
			$compact={compact}
			$live={channel.live}
			$wentLive={wentLive > 0}
		>
			<Avatar $host={host} $live={channel.live}>
				{channel.avatarUrl ? <img src={channel.avatarUrl} alt="" loading="lazy" /> : <AvatarFallback />}
				{compact && channel.live && <CompactLiveDot $host={host} $stale={!!channel.stale} />}
				<PlatformDot
					$host={host}
					$platform={channel.platform}
					$linked={!!channel.linked}
					title={channel.linked ? "Linked Twitch and Kick channels" : PLATFORM_NAMES[channel.platform]}
				>
					{channel.linked && <LinkedPlatformIcon />}
				</PlatformDot>
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
						<Viewers $host={host} $stale={!!channel.stale}>
							<LiveDot $host={host} $stale={!!channel.stale} />
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
	display: flex;
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

const HeaderButton = styled.button<HostProps>`
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	width: 28px;
	height: 28px;
	padding: 0;
	border: none;
	background: ${({ $host }) => ($host === "kick" ? "rgba(255, 255, 255, 0.04)" : "none")};
	font: inherit;
	cursor: pointer;
	border-radius: ${({ $host }) => ($host === "kick" ? "6px" : "var(--border-radius-medium)")};
	color: ${({ $host }) => ($host === "kick" ? "rgba(255, 255, 255, 0.6)" : "var(--color-text-alt-2)")};

	&:hover,
	&:focus-visible,
	&[data-open] {
		color: ${({ $host }) => ($host === "kick" ? "#fff" : "var(--color-text-base)")};
		background: ${({ $host }) =>
			$host === "kick" ? "rgba(255, 255, 255, 0.08)" : "var(--color-background-button-text-hover)"};
	}
`;

const SearchRow = styled.div<HostProps>`
	display: flex;
	padding: ${({ $host }) => ($host === "kick" ? "0 0 0 6px" : "0 8px 6px")};
`;

const SearchInput = styled.input<HostProps>`
	flex: 1;
	min-width: 0;
	height: 30px;
	box-sizing: border-box;
	margin: 0;
	padding: 0 10px;
	font: inherit;
	font-size: 13px;
	outline: none;

	${({ $host }) =>
		$host === "kick"
			? css`
					color: #fff;
					background: rgba(255, 255, 255, 0.06);
					border: 1px solid rgba(255, 255, 255, 0.12);
					border-radius: 6px;
					&::placeholder {
						color: rgba(255, 255, 255, 0.5);
					}
					&:focus {
						border-color: #53fc18;
					}
				`
			: css`
					color: var(--color-text-input);
					background: var(--color-background-input);
					border: 1px solid var(--color-border-input);
					border-radius: var(--input-border-radius-default, var(--border-radius-medium));
					&::placeholder {
						color: var(--color-text-input-placeholder);
					}
					&:focus {
						border-color: var(--color-border-input-focus);
					}
				`}
`;

const Notice = styled.p<HostProps>`
	margin: 0;
	font-size: 12px;
	line-height: 1.4;
	padding: ${({ $host }) => ($host === "kick" ? "0 6px" : "2px 8px 6px")};
	color: ${({ $host }) => ($host === "kick" ? "rgba(255, 255, 255, 0.6)" : "var(--color-text-alt-2)")};
`;

const List = styled.div<{ $spaced: boolean }>`
	display: flex;
	flex-direction: column;
	gap: ${({ $spaced }) => ($spaced ? "8px" : "0")};

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

type StaleProps = { $stale: boolean };

const Viewers = styled.span<HostProps & StaleProps>`
	display: flex;
	align-items: center;
	gap: 5px;
	flex-shrink: 0;
	align-self: flex-start;
	opacity: ${({ $stale }) => ($stale ? 0.5 : 1)};
	font-size: ${({ $host }) => ($host === "kick" ? "14px" : "13px")};
	font-weight: ${({ $host }) => ($host === "kick" ? 600 : 400)};
	color: ${({ $host }) => ($host === "kick" ? "#fff" : "var(--color-text-alt)")};
`;

const LiveDot = styled.span<HostProps & StaleProps>`
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: ${({ $host, $stale }) => ($stale ? "#8a8a8a" : $host === "kick" ? "#53fc18" : "#eb0400")};
`;

const updatingSpin = keyframes`
	to { transform: rotate(360deg); }
`;

const UpdatingSpinner = styled.span<HostProps>`
	display: block;
	flex-shrink: 0;
	box-sizing: border-box;
	width: 14px;
	height: 14px;
	border: 2px solid ${({ $host }) => ($host === "kick" ? "rgba(255, 255, 255, 0.2)" : "var(--color-border-base)")};
	border-top-color: ${({ $host }) => ($host === "kick" ? "#53fc18" : "#9147ff")};
	border-radius: 50%;
	animation: ${updatingSpin} 0.8s linear infinite;
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

const PlatformDot = styled.span<HostProps & { $platform: PlatformType; $linked: boolean }>`
	position: absolute;
	right: -3px;
	bottom: -3px;
	box-sizing: border-box;
	width: 12px;
	height: 12px;
	border-radius: 50%;
	background: ${({ $platform, $linked }) => ($linked ? "none" : PLATFORM_COLORS[$platform])};
	border: 2px solid ${({ $host }) => ($host === "kick" ? "#090b0f" : "var(--color-background-base)")};

	svg {
		display: block;
		width: 100%;
		height: 100%;
	}
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
