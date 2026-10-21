import {
	AvatarPlatformDot,
	LinkedPlatformIcon,
	formatAgo,
	getFollowsComparator,
	getFollowsSortOptions,
	getVisibleProblem,
	PinIcon,
	PLATFORM_NAMES,
	PLATFORM_URLS,
	PlatformIcon,
} from "$shared/components/cross-platform-follows/platform.shared.tsx";
import {
	ChannelContextMenu,
	LinkChannelDialog,
} from "$shared/components/cross-platform-follows/link-channel.component.tsx";
import { PlatformFilterComponent } from "$shared/components/platform-filter/platform-filter.component.tsx";
import { SortMenuComponent } from "$shared/components/sort-menu/sort-menu.component.tsx";
import { FollowsHomeTileComponent } from "$shared/components/follows-home/follows-home-tile.component.tsx";
import { HOME_ANIMATION_KEY, useFollowsHomeAnimation } from "$shared/utils/follows-home-animation.utils.ts";
import { useChannelLinks } from "$shared/utils/channel-links.utils.ts";
import { filterFollowsByPlatform } from "$shared/utils/follows-filter.utils.ts";
import { getFollowEntryKey, getPinTargets, mergeLinkedChannels } from "$shared/utils/follows-links.utils.ts";
import { FOLLOWS_SORT_LABELS, parseFollowsSort } from "$shared/utils/follows-sort.utils.ts";
import type { GlobalSettings } from "$types/shared/settings/global-settings.types.ts";
import type {
	ChannelMenuState,
	SidebarChannel,
} from "$types/shared/components/cross-platform-follows.component.types.ts";
import type {
	FollowsHomeChannel,
	FollowsHomeMessage,
	FollowsHomeSnapshots,
	FollowsHomeSort,
} from "$types/shared/components/follows-home.component.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { ChannelLinksTransport } from "$types/shared/utils/channel-links.types.ts";
import type {
	CrossPlatformFollowsSnapshot,
	FollowsPlatformFilter,
} from "$types/shared/worker/cross-platform-follows-worker.types.ts";
import type { WorkerBroadcast } from "$types/shared/worker/worker.types.ts";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import styled, { createGlobalStyle, css } from "styled-components";

const REFRESH_INTERVAL_MS = 60_000;
const REFRESHING_RETRY_MS = 3_000;
const OFFLINE_COLLAPSED_COUNT = 12;
const PLATFORMS: PlatformType[] = ["twitch", "kick"];
const HOST_BACKGROUNDS: Record<PlatformType, string> = { twitch: "#0e0e10", kick: "#090b0f" };
const HOST_PLATFORM: PlatformType =
	new URLSearchParams(window.location.search).get("host") === "kick" ? "kick" : "twitch";
function resolveBackground(): string {
	const params = new URLSearchParams(window.location.search);
	const host = params.get("host");
	const fallback = host === "kick" ? HOST_BACKGROUNDS.kick : HOST_BACKGROUNDS.twitch;
	const background = params.get("bg");
	if (!background || !CSS.supports("color", background)) return fallback;
	const [red = 0, green = 0, blue = 0, alpha = 1] = (background.match(/[\d.]+/g) ?? []).map(Number);
	const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
	return alpha > 0 && luminance < 0.3 ? background : fallback;
}

function setPinned(channel: SidebarChannel, pinned: boolean) {
	chrome.runtime
		.sendMessage({
			action: "setChannelPinned",
			payload: { platform: channel.platform, login: channel.login, pinned },
		})
		.catch(() => {});
}

async function fetchSnapshot(platform: PlatformType): Promise<CrossPlatformFollowsSnapshot | null> {
	try {
		const response = await chrome.runtime.sendMessage({
			action: "getFollowsStatus",
			payload: { platform, refresh: true },
		});
		if (!response || "__enhancerWorkerError" in response) return null;
		return response as CrossPlatformFollowsSnapshot;
	} catch {
		return null;
	}
}

const LINKS_TRANSPORT: ChannelLinksTransport = {
	send: async (action, payload) => {
		try {
			const response = await chrome.runtime.sendMessage({ action, payload });
			return response && !("__enhancerWorkerError" in response) ? response : null;
		} catch {
			return null;
		}
	},
	subscribe: (handler) => {
		const listener = (message: WorkerBroadcast) => {
			if (message?.type === "channel-links-updated") handler(message.payload);
		};
		chrome.runtime.onMessage.addListener(listener);
		return () => chrome.runtime.onMessage.removeListener(listener);
	},
};

function postToHost(message: FollowsHomeMessage) {
	window.parent.postMessage(message, "*");
}

export function FollowsHomeComponent() {
	const embedded = window.parent !== window;
	const [snapshots, setSnapshots] = useState<FollowsHomeSnapshots>({});
	const [loaded, setLoaded] = useState(false);
	const [filter, setFilter] = useState<FollowsPlatformFilter>("all");
	const [sort, setSort] = useState<FollowsHomeSort>("recommended");
	const [pinsEnabled, setPinsEnabled] = useState(true);

	useEffect(() => {
		const applySettings = (settings: GlobalSettings | undefined) => {
			if (!settings) return;
			setPinsEnabled(settings.pinnedStreamersEnabled);
			setSort(parseFollowsSort(settings.followsSort));
			setFilter(settings.followsPlatformFilter);
		};
		chrome.runtime
			.sendMessage({ action: "getGlobalSettings", payload: {} })
			.then(applySettings)
			.catch(() => {});
		const handleSettings = (message: WorkerBroadcast) => {
			if (message?.type === "global-settings-updated") applySettings(message.payload);
		};
		chrome.runtime.onMessage.addListener(handleSettings);
		return () => chrome.runtime.onMessage.removeListener(handleSettings);
	}, []);
	const [offlinePages, setOfflinePages] = useState(1);
	const pageRef = useRef<HTMLElement>(null);
	const [now, setNow] = useState(() => Date.now());
	const [background] = useState(resolveBackground);
	const channelLinks = useChannelLinks(LINKS_TRANSPORT);
	const [menu, setMenu] = useState<ChannelMenuState | null>(null);
	const [linking, setLinking] = useState<SidebarChannel | null>(null);

	const changeSort = (option: FollowsHomeSort) => {
		void switchView(() => setSort(option));
		chrome.runtime
			.sendMessage({ action: "updateGlobalSettings", payload: { settings: { followsSort: option } } })
			.catch(() => {});
	};

	const changeFilter = (option: FollowsPlatformFilter) => {
		void switchView(() => setFilter(option));
		chrome.runtime
			.sendMessage({ action: "updateGlobalSettings", payload: { settings: { followsPlatformFilter: option } } })
			.catch(() => {});
	};

	useEffect(() => {
		let disposed = false;
		let followUp: number | undefined;
		const load = async () => {
			if (document.visibilityState !== "visible") return;
			const results = await Promise.all(PLATFORMS.map(fetchSnapshot));
			if (disposed) return;
			setSnapshots((previous) => {
				const next = { ...previous };
				results.forEach((snapshot, index) => {
					if (snapshot) next[PLATFORMS[index]] = snapshot;
				});
				return next;
			});
			setLoaded(true);
			setNow(Date.now());
			if (results.some((snapshot) => snapshot?.refreshing)) {
				window.clearTimeout(followUp);
				followUp = window.setTimeout(load, REFRESHING_RETRY_MS);
			}
		};

		const handleBroadcast = (message: WorkerBroadcast) => {
			if (message?.type !== "cross-platform-follows-updated") return;
			const snapshot = message.payload;
			setSnapshots((previous) => ({ ...previous, [snapshot.platform]: snapshot }));
			setLoaded(true);
		};
		chrome.runtime.onMessage.addListener(handleBroadcast);

		void load();
		const interval = window.setInterval(load, REFRESH_INTERVAL_MS);
		const clock = window.setInterval(() => setNow(Date.now()), 30_000);
		document.addEventListener("visibilitychange", load);
		return () => {
			disposed = true;
			chrome.runtime.onMessage.removeListener(handleBroadcast);
			window.clearTimeout(followUp);
			window.clearInterval(interval);
			window.clearInterval(clock);
			document.removeEventListener("visibilitychange", load);
		};
	}, []);

	const channels = useMemo(() => {
		const all: FollowsHomeChannel[] = [];
		for (const platform of PLATFORMS) {
			const snapshot = snapshots[platform];
			if (!snapshot) continue;
			for (const channel of snapshot.channels) {
				all.push({ ...channel, pinned: pinsEnabled && channel.pinned, platform, checkedAt: snapshot.checkedAt });
			}
		}
		return mergeLinkedChannels(all, channelLinks.links);
	}, [snapshots, pinsEnabled, channelLinks.links]);

	const sortOptions = getFollowsSortOptions(channels);
	const activeSort: FollowsHomeSort = sortOptions.includes(sort) ? sort : "viewers-desc";
	const compare = getFollowsComparator(activeSort, now);
	const visible = filterFollowsByPlatform(channels, filter);
	const live = visible.filter((channel) => channel.live).sort(compare);
	const offline = visible.filter((channel) => !channel.live).sort(compare);
	const shownOffline = offline.slice(
		0,
		Math.max(OFFLINE_COLLAPSED_COUNT * offlinePages, offline.filter((channel) => channel.pinned).length),
	);
	const liveCounts = {
		all: channels.filter((channel) => channel.live).length,
		twitch: filterFollowsByPlatform(channels, "twitch").filter((channel) => channel.live).length,
		kick: filterFollowsByPlatform(channels, "kick").filter((channel) => channel.live).length,
	};
	const emptyFilterText =
		filter !== "all" && visible.length === 0 && snapshots[filter]?.synced
			? `You don't follow anyone on ${PLATFORM_NAMES[filter]} yet.`
			: null;
	const unsynced = PLATFORMS.filter((platform) => loaded && !snapshots[platform]?.synced);
	const problems = PLATFORMS.filter((platform) => getVisibleProblem(snapshots[platform]));

	const switchView = useFollowsHomeAnimation(pageRef, [
		...live.map((channel) => `live:${getFollowEntryKey(channel)}`),
		...shownOffline.map((channel) => `offline:${getFollowEntryKey(channel)}`),
	]);

	const handleNavigate = (url: string, event: MouseEvent) => {
		if (!embedded || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
		event.preventDefault();
		postToHost({ source: "enhancer-follows-home", type: "navigate", url });
	};

	const handleTogglePin = (channel: SidebarChannel) => {
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
		for (const target of targets) setPinned(target, pinned);
	};

	const openMenu = (event: MouseEvent, channel: SidebarChannel) =>
		setMenu({ channel, anchor: event.currentTarget as Element, x: event.clientX, y: event.clientY });

	const linkChannels = (source: SidebarChannel, target: SidebarChannel, primary: PlatformType) => {
		channelLinks.link(source, target, primary);
		setLinking(null);
	};

	return (
		<Page ref={pageRef}>
			<GlobalStyle $background={background} />
			<Header>
				<Filters>
					<PlatformFilterComponent value={filter} onChange={changeFilter} theme="home" liveCounts={liveCounts} />
					{channels.length > 0 && (
						<SortSelect>
							<SortMenuComponent
								value={activeSort}
								options={sortOptions}
								labels={FOLLOWS_SORT_LABELS}
								onChange={changeSort}
								theme="home"
								label="Sort followed channels"
								renderTrigger={(open) => (
									<>
										<span>Sort by</span>
										<strong>{FOLLOWS_SORT_LABELS[activeSort]}</strong>
										<Chevron $open={open} width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
											<path
												d="m6 9 6 6 6-6"
												fill="none"
												stroke="currentColor"
												stroke-width="2.5"
												stroke-linecap="round"
												stroke-linejoin="round"
											/>
										</Chevron>
									</>
								)}
							/>
						</SortSelect>
					)}
				</Filters>
				{embedded && (
					<OriginalButton
						title={`Show the original ${PLATFORM_NAMES[HOST_PLATFORM]} home page`}
						onClick={() => postToHost({ source: "enhancer-follows-home", type: "show-original" })}
					>
						<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
							<path
								d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							/>
						</svg>
						Original {PLATFORM_NAMES[HOST_PLATFORM]} home
					</OriginalButton>
				)}
			</Header>

			{unsynced.map((platform) => (
				<Notice key={platform}>
					<PlatformIcon platform={platform} size={16} />
					<span>
						Open {platform === "kick" ? "kick.com" : "twitch.tv"} once while logged in to load your{" "}
						{PLATFORM_NAMES[platform]} follows.
					</span>
				</Notice>
			))}
			{problems.map((platform) => (
				<Notice key={platform}>
					<PlatformIcon platform={platform} size={16} />
					<span>
						{getVisibleProblem(snapshots[platform]) === "session-missing"
							? `Live status for ${PLATFORM_NAMES[platform]} is paused. Open ${PLATFORM_NAMES[platform]} while logged in to resume it.`
							: `Could not refresh ${PLATFORM_NAMES[platform]} right now. Showing the last known status.`}
					</span>
				</Notice>
			))}

			{loaded && emptyFilterText && <Empty>{emptyFilterText}</Empty>}
			{loaded && !emptyFilterText && live.length === 0 && channels.length > 0 && (
				<Empty>Nobody you follow is live right now.</Empty>
			)}

			{live.length > 0 && (
				<Grid>
					{live.map((channel) => (
						<FollowsHomeTileComponent
							key={getFollowEntryKey(channel)}
							channel={channel}
							now={now}
							onNavigate={handleNavigate}
							onTogglePin={pinsEnabled ? handleTogglePin : undefined}
							onContextMenu={openMenu}
						/>
					))}
				</Grid>
			)}

			{offline.length > 0 && (
				<Section>
					<SectionTitle>
						Offline <span>{offline.length}</span>
					</SectionTitle>
					<OfflineGrid>
						{shownOffline.map((channel) => {
							const url = PLATFORM_URLS[channel.platform](channel.login);
							return (
								<OfflineRow
									key={getFollowEntryKey(channel)}
									{...{ [HOME_ANIMATION_KEY]: `offline:${getFollowEntryKey(channel)}` }}
									href={url}
									target="_top"
									onClick={(event) => handleNavigate(url, event)}
									onContextMenu={(event: MouseEvent) => {
										if (event.shiftKey) return;
										event.preventDefault();
										openMenu(event, channel);
									}}
								>
									<OfflineAvatar>
										{channel.avatarUrl && <img src={channel.avatarUrl} alt="" />}
										<AvatarPlatformDot
											$platform={channel.platform}
											$linked={!!channel.linked}
											$size={12}
											$border="var(--page-background)"
											title={channel.linked ? "Linked Twitch and Kick channels" : PLATFORM_NAMES[channel.platform]}
										>
											{channel.linked && <LinkedPlatformIcon />}
										</AvatarPlatformDot>
									</OfflineAvatar>
									<OfflineText>
										<OfflineName>
											<strong>{channel.displayName}</strong>
										</OfflineName>
										<small>{channel.lastLiveAt ? `Live ${formatAgo(channel.lastLiveAt, now)}` : "Offline"}</small>
									</OfflineText>
									{pinsEnabled && (
										<OfflinePin
											type="button"
											$pinned={channel.pinned}
											aria-label={channel.pinned ? "Unpin channel" : "Pin channel"}
											title={channel.pinned ? "Unpin channel" : "Pin channel"}
											onClick={(event) => {
												event.preventDefault();
												event.stopPropagation();
												handleTogglePin(channel);
											}}
										>
											<PinIcon filled={channel.pinned} size={12} />
										</OfflinePin>
									)}
								</OfflineRow>
							);
						})}
					</OfflineGrid>
					{offline.length > OFFLINE_COLLAPSED_COUNT && (
						<OfflineActions>
							{offline.length > shownOffline.length && (
								<GhostButton onClick={() => setOfflinePages(offlinePages + 1)}>Show more</GhostButton>
							)}
							{offlinePages > 1 && <GhostButton onClick={() => setOfflinePages(1)}>Show less</GhostButton>}
						</OfflineActions>
					)}
				</Section>
			)}
			{menu && (
				<ChannelContextMenu
					{...menu}
					host={HOST_PLATFORM}
					pinsEnabled={pinsEnabled}
					onTogglePin={handleTogglePin}
					onLink={setLinking}
					onPrefer={channelLinks.prefer}
					onUnlink={channelLinks.unlink}
					onClose={() => setMenu(null)}
				/>
			)}
			{linking && (
				<LinkChannelDialog
					channel={linking}
					channels={channels}
					host={HOST_PLATFORM}
					onLink={(target, primary) => linkChannels(linking, target, primary)}
					onClose={() => setLinking(null)}
				/>
			)}
		</Page>
	);
}

const GlobalStyle = createGlobalStyle<{ $background: string }>`
	* { box-sizing: border-box; }
	:root { --page-background: ${(props) => props.$background}; }
	html, body {
		margin: 0;
		background: var(--page-background);
		color: white;
		font-family: Inter, Roobert, "Helvetica Neue", Helvetica, Arial, sans-serif;
		color-scheme: dark;
	}
	body::-webkit-scrollbar { width: 10px; }
	body::-webkit-scrollbar-thumb { background: #232323; border-radius: 5px; }
`;

const Page = styled.main`
	position: relative;
	display: flex;
	flex-direction: column;
	gap: 20px;
	max-width: 1800px;
	margin: 0 auto;
	padding: 28px 32px 48px;
`;

const Header = styled.header`
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 16px;
`;

const Filters = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin-right: auto;
`;

const buttonBase = css`
	display: inline-flex;
	align-items: center;
	gap: 6px;
	height: 32px;
	padding: 0 12px;
	border: none;
	border-radius: 6px;
	font: inherit;
	font-size: 13px;
	font-weight: 600;
	cursor: pointer;
`;

const SortSelect = styled.div`
	display: inline-flex;

	> button {
		gap: 6px;
		height: 36px;
		padding: 0 12px 0 14px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.05);
		color: #a6a6a6;
		font-size: 13px;
		font-weight: 600;
		transition:
			background 0.2s ease,
			color 0.2s ease;
	}

	> button:hover,
	> button:focus-visible,
	> button[data-open] {
		background: rgba(255, 255, 255, 0.09);
		color: white;
	}

	strong {
		color: white;
		font-weight: 600;
	}
`;

const Chevron = styled.svg<{ $open: boolean }>`
	margin-left: 2px;
	transform: rotate(${(props) => (props.$open ? "180deg" : "0deg")});
	transition: transform 0.15s ease;
`;

const OriginalButton = styled.button`
	${buttonBase};
	height: 36px;
	padding: 0 12px;
	border-radius: 999px;
	background: transparent;
	color: #8a8a8a;
	transition:
		background 0.2s ease,
		color 0.2s ease;

	&:hover {
		background: rgba(255, 255, 255, 0.06);
		color: white;
	}
`;

const GhostButton = styled.button`
	${buttonBase};
	align-self: center;
	border: 1px solid #232323;
	background: transparent;
	color: #ccc;

	&:hover {
		border-color: #3a3a3a;
		color: white;
	}
`;

const Notice = styled.div`
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 12px 16px;
	border: 1px solid #232323;
	border-radius: 8px;
	color: #ccc;
	font-size: 13px;

	span {
		flex: 1;
	}
`;

const Empty = styled.p`
	margin: 40px 0;
	color: #8a8a8a;
	text-align: center;
`;

const Grid = styled.div`
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
	gap: 28px 20px;
`;

const Section = styled.section`
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 12px;
	margin-top: 12px;
`;

const SectionTitle = styled.h2`
	margin: 0;
	font-size: 16px;
	font-weight: 700;

	span {
		margin-left: 6px;
		color: #565656;
	}
`;

const OfflineGrid = styled.div`
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
	gap: 4px;
	width: 100%;
`;

const OfflineRow = styled.a`
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 6px 8px;
	border-radius: 6px;
	color: inherit;
	text-decoration: none;

	&:hover {
		background: #161616;
	}

	&:hover button {
		opacity: 1;
	}
`;

const OfflineAvatar = styled.span`
	position: relative;
	flex-shrink: 0;
	width: 32px;
	height: 32px;
	border-radius: 50%;
	background: #232323;

	img {
		width: 100%;
		height: 100%;
		border-radius: 50%;
		filter: grayscale(1);
		opacity: 0.7;
	}
`;

const OfflineText = styled.span`
	display: flex;
	flex-direction: column;
	min-width: 0;

	svg {
		flex-shrink: 0;
	}

	strong {
		overflow: hidden;
		color: #ccc;
		font-size: 13px;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	small {
		color: #565656;
		font-size: 12px;
	}
`;

const OfflinePin = styled.button<{ $pinned: boolean }>`
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	width: 24px;
	height: 24px;
	margin-left: auto;
	padding: 0;
	border: none;
	border-radius: 6px;
	cursor: pointer;
	background: ${(props) => (props.$pinned ? "rgba(145, 71, 255, 0.2)" : "transparent")};
	color: ${(props) => (props.$pinned ? "#bf94ff" : "#8a8a8a")};
	opacity: ${(props) => (props.$pinned ? 1 : 0)};

	&:hover {
		color: white;
		background: #232323;
	}
`;

const OfflineActions = styled.div`
	display: flex;
	align-self: center;
	gap: 8px;
`;

const OfflineName = styled.span`
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
`;
