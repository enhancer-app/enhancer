import { TooltipComponent } from "$shared/components/tooltip/tooltip.component.tsx";
import type WorkerService from "$shared/worker/worker.service.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import { useEffect, useState } from "preact/hooks";
import styled from "styled-components";

const Container = styled.div<{ $platform: PlatformType }>`
	padding: ${({ $platform }) => {
		if ($platform === "twitch") return "8px";
		if ($platform === "kick") return "18px";
		return "18px";
	}};
	font-family: ${({ $platform }) => {
		if ($platform === "twitch") {
			return '"Inter", "Noto Sans Arabic", "Roobert", "Helvetica Neue", Helvetica, Arial, sans-serif';
		}
		if ($platform === "kick") {
			return 'Inter, "Inter Fallback", sans-serif';
		}
		return "inherit";
	}};
	border-radius: 8px;

	a { text-decoration: none; }
`;

const Header = styled.div`
	font-size: 14px;
	font-weight: 700;
	color: #efeff1;
	margin-bottom: 12px;
`;

const StreamerList = styled.div`
	display: flex;
	flex-direction: column;
	gap: 8px;
`;

const StreamerItem = styled.a`
	display: flex;
	align-items: center;
	gap: 10px;
	border-radius: 6px;
	text-decoration: none;
	color: inherit;
	transition: background 0.2s ease;

	&:hover {
		opacity: 0.8;
	}
`;

const Avatar = styled.img<{ $platform: PlatformType; $isLive: boolean }>`
	width: 32px;
	height: 32px;
	border-radius: 50%;
	border: 2px solid ${({ $platform, $isLive }) => {
		if (!$isLive) return "transparent";
		switch ($platform) {
			case "kick":
				return "#53FC18";
			case "twitch":
				return "#9146FF";
			default:
				return "transparent";
		}
	}};
	padding: 1px;
	filter: ${({ $isLive }) => ($isLive ? "none" : "grayscale(100%)")};
	opacity: ${({ $isLive }) => ($isLive ? "1" : "0.7")};
`;

const StreamerInfo = styled.div`
	display: flex;
	flex-direction: column;
	flex: 1;
	min-width: 0;
`;

const TopRow = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: baseline;
	width: 100%;
`;

const Username = styled.div<{ $platform: PlatformType; $isLive: boolean }>`
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	padding-right: 8px;
	opacity: ${({ $isLive }) => ($isLive ? "1" : "0.7")};
	${({ $platform }) =>
		$platform === "twitch"
			? `
        font-weight: 600;
        color: #efeff1;
        font-size: 14px;
        line-height: 1.2;
    `
			: `
        font-size: 14px;
        font-weight: 600;
        color: #efeff1;
    `}
`;

const Game = styled.div<{ $platform: PlatformType }>`
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	${({ $platform }) =>
		$platform === "twitch"
			? `
        color: #adadb8;
        font-size: 14px;
        line-height: 1.5;
    `
			: `
        font-size: 12px;
        color: #adadb8;
    `}
`;

const ViewerCount = styled.div<{ $platform: PlatformType }>`
	white-space: nowrap;
	flex-shrink: 0;
	${({ $platform }) =>
		$platform === "twitch"
			? `
        color: #efeff1;
        font-size: 13px;
        line-height: 1.5;
    `
			: `
        font-size: 13px;
        color: #efeff1;
    `}
`;

const OfflineDate = styled.div`
	white-space: nowrap;
	flex-shrink: 0;
	color: #adadb8;
	font-size: 12px;
`;

const LiveDot = styled.span<{ $platform: PlatformType }>`
	display: inline-block;
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: ${({ $platform }) => {
		if ($platform === "twitch") return "#eb0400";
		if ($platform === "kick") return "#53fc18";
		return "#ff4d4d";
	}};
	margin-right: 6px;
`;

const EmptyText = styled.div`
	font-size: 12px;
	color: #adadb8;
	text-align: center;
	padding: 20px;
`;

const LoadingText = styled.div`
	font-size: 12px;
	color: #adadb8;
	text-align: center;
	padding: 20px;
`;

const Footer = styled.div`
	display: flex;
	width: 100%;
	padding-top: 12px;
`;

const ToggleButton = styled.button`
	background: transparent;
	border: none;
	color: #adadb8;
	cursor: pointer;
	font-size: 12px;
	text-decoration: none;
	padding: 4px 8px;

	&:hover {
		color: #efeff1;
	}
`;

const SeeLessButton = styled(ToggleButton)`
    margin-left: auto;
`;

const SeeMoreButton = styled(ToggleButton)`
    margin-right: auto;
`;

// --- Interfaces & Helpers ---

interface LiveStreamerData {
	displayName: string | null;
	username: string;
	gameName: string | null;
	title: string | null;
	viewerCount: number;
	channelId: string;
	profilePictureUrl: string | null;
	platform: PlatformType;
	isLive: boolean;
	lastLiveAt: number | null;
}

const FETCH_INTERVAL_MS = 30_000;
const PAGE_SIZE = 10;

interface LiveStreamersComponentProps {
	currentPlatform: PlatformType;
	workerService: WorkerService;
}

export default function LiveStreamersComponent({ currentPlatform, workerService }: LiveStreamersComponentProps) {
	const [streamers, setStreamers] = useState<LiveStreamerData[]>([]);
	const [loading, setLoading] = useState(true);
	const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

	const fetchStreamers = async () => {
		try {
			const response = await workerService.send("getLiveStreamersCache", {});
			if (!response) return;

			// 1. Map raw data to our interface
			const mappedStreamers: LiveStreamerData[] = response.streamers
				.filter((s: { platform: PlatformType }) => s.platform !== currentPlatform) // Show all not on current platform
				.map(
					(s: {
						displayName: string | null;
						username: string;
						gameName: string | null;
						title: string | null;
						viewerCount: number;
						channelId: string;
						profilePictureUrl: string | null;
						platform: PlatformType;
						isLive: boolean;
						lastLiveAt: number | null;
					}) => ({
						displayName: s.displayName,
						username: s.username,
						gameName: s.gameName,
						title: s.title,
						viewerCount: s.viewerCount,
						channelId: s.channelId,
						profilePictureUrl: s.profilePictureUrl,
						platform: s.platform,
						isLive: s.isLive,
						lastLiveAt: s.lastLiveAt,
					}),
				);

			// 2. Sort: Live (by viewers) -> Offline (by date)
			mappedStreamers.sort((a, b) => {
				if (a.isLive && !b.isLive) return -1;
				if (!a.isLive && b.isLive) return 1;

				if (a.isLive) {
					// Both Live: Sort by Viewers Desc
					return b.viewerCount - a.viewerCount;
				}
				// Both Offline: Sort by LastLiveAt Desc
				return (b.lastLiveAt || 0) - (a.lastLiveAt || 0);
			});

			setStreamers(mappedStreamers);
		} catch (error) {
			console.error("Failed to fetch live streamers:", error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchStreamers();
		const interval = setInterval(fetchStreamers, FETCH_INTERVAL_MS);
		return () => clearInterval(interval);
	}, []);

	const getStreamerUrl = (username: string, platform: PlatformType): string | null => {
		switch (platform) {
			case "twitch":
				return `https://twitch.tv/${username}`;
			case "kick":
				return `https://kick.com/${username}`;
			default:
				return null;
		}
	};

	const formatViewers = (count: number): string => {
		if (Math.abs(count) < 1000) {
			return count.toString();
		}
		return `${Number.parseFloat((count / 1000).toFixed(1))}K`;
	};

	const getPlatformDisplayName = (platform: string): string => {
		return platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase();
	};

	const handleShowMore = () => setVisibleCount((prev) => prev + PAGE_SIZE);
	const handleShowLess = () => setVisibleCount(PAGE_SIZE);

	const visibleStreamers = streamers.slice(0, visibleCount);
	const hasMore = visibleCount < streamers.length;
	const isExpanded = visibleCount > PAGE_SIZE;

	if (loading) {
		return (
			<Container $platform={currentPlatform}>
				<Header>Shared Followers</Header>
				<LoadingText>Loading...</LoadingText>
			</Container>
		);
	}

	if (streamers.length === 0) {
		return (
			<Container $platform={currentPlatform}>
				<Header>Shared Followers</Header>
				<EmptyText>No shared followers found</EmptyText>
			</Container>
		);
	}

	return (
		<Container $platform={currentPlatform}>
			<Header>Shared Followers</Header>
			<StreamerList>
				{visibleStreamers.map((streamer) => {
					// Only show tooltip if they have a title (usually only live streams do)
					const StreamerWrapper = streamer.title
						? ({ children }: { children: preact.ComponentChildren }) => (
								<TooltipComponent content={streamer.title} position="right">
									{children}
								</TooltipComponent>
							)
						: ({ children }: { children: preact.ComponentChildren }) => <>{children}</>;

					return (
						<StreamerWrapper key={streamer.channelId}>
							<StreamerItem
								key={streamer.channelId}
								href={getStreamerUrl(streamer.username, streamer.platform) || "#"}
								target="_blank"
								rel="noopener noreferrer"
							>
								<Avatar
									src={streamer.profilePictureUrl ?? ""}
									alt={streamer.username}
									$platform={streamer.platform}
									$isLive={streamer.isLive}
								/>
								<StreamerInfo>
									<TopRow>
										<Username $platform={currentPlatform} $isLive={streamer.isLive}>
											{streamer.displayName ?? streamer.username}
										</Username>

										{streamer.isLive ? (
											<ViewerCount $platform={currentPlatform}>
												<LiveDot $platform={currentPlatform} />
												{formatViewers(streamer.viewerCount)}
											</ViewerCount>
										) : (
											<OfflineDate>Offline</OfflineDate>
										)}
									</TopRow>
									<Game
										$platform={currentPlatform}
										title={`${streamer.gameName ?? getPlatformDisplayName(streamer.platform)}`}
									>
										{streamer.gameName ?? getPlatformDisplayName(streamer.platform)}
									</Game>
								</StreamerInfo>
							</StreamerItem>
						</StreamerWrapper>
					);
				})}
			</StreamerList>

			<Footer>
				{hasMore && (
					<SeeMoreButton type="button" onClick={handleShowMore}>
						See More
					</SeeMoreButton>
				)}
				{isExpanded && (
					<SeeLessButton type="button" onClick={handleShowLess}>
						See Less
					</SeeLessButton>
				)}
			</Footer>
		</Container>
	);
}
