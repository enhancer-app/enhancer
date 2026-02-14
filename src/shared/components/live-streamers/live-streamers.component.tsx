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
`;

const Avatar = styled.img<{ $platform: PlatformType }>`
	width: 32px;
	height: 32px;
	border-radius: 50%;
	border: 2px solid ${({ $platform }) => {
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

const Username = styled.div<{ $platform: PlatformType }>`
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	padding-right: 8px;
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

interface LiveStreamerData {
	displayName: string | null;
	username: string;
	gameName: string | null;
	title: string | null;
	viewerCount: number;
	channelId: string;
	profilePictureUrl: string | null;
	platform: PlatformType;
}

const FETCH_INTERVAL_MS = 30_000;

interface LiveStreamersComponentProps {
	currentPlatform: PlatformType;
	workerService: WorkerService;
}

export default function LiveStreamersComponent({ currentPlatform, workerService }: LiveStreamersComponentProps) {
	const [streamers, setStreamers] = useState<LiveStreamerData[]>([]);
	const [loading, setLoading] = useState(true);

	const fetchStreamers = async () => {
		try {
			const response = await workerService.send("getLiveStreamersCache", {});
			if (!response) return;

			const liveStreamers: LiveStreamerData[] = response.streamers
				.filter((s: { platform: PlatformType; isLive: boolean }) => s.platform !== currentPlatform && s.isLive)
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
					}) => ({
						displayName: s.displayName,
						username: s.username,
						gameName: s.gameName,
						title: s.title,
						viewerCount: s.viewerCount,
						channelId: s.channelId,
						profilePictureUrl: s.profilePictureUrl,
						platform: s.platform,
					}),
				)
				.sort((a: LiveStreamerData, b: LiveStreamerData) => b.viewerCount - a.viewerCount);

			setStreamers(liveStreamers);
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

	const getPlatformDisplayName = (platform: string): string => {
		return platform.charAt(0).toUpperCase() + platform.slice(1).toLowerCase();
	};

	const formatViewers = (count: number): string => {
		if (Math.abs(count) < 1000) {
			return count.toString();
		}
		return `${Number.parseFloat((count / 1000).toFixed(1))}K`;
	};

	if (loading) {
		return (
			<Container $platform={currentPlatform}>
				<Header>Enhancer Followers</Header>
				<LoadingText>Loading...</LoadingText>
			</Container>
		);
	}

	if (streamers.length === 0) {
		return (
			<Container $platform={currentPlatform}>
				<Header>Enhancer Followers</Header>
				<EmptyText>No live streamers</EmptyText>
			</Container>
		);
	}

	return (
		<Container $platform={currentPlatform}>
			<Header>Enhancer Followers</Header>
			<StreamerList>
				{streamers.map((streamer) => (
					<StreamerItem
						key={streamer.channelId}
						href={getStreamerUrl(streamer.username, streamer.platform) || "#"}
						target="_blank"
						rel="noopener noreferrer"
					>
						<Avatar src={streamer.profilePictureUrl ?? ""} alt={streamer.username} $platform={streamer.platform} />
						<StreamerInfo>
							<TopRow>
								<Username
									$platform={currentPlatform}
									title={`${streamer.displayName ?? streamer.username} live at ${getPlatformDisplayName(streamer.platform)}`}
								>
									{streamer.displayName ?? streamer.username}
								</Username>
								<ViewerCount $platform={currentPlatform}>
									<LiveDot $platform={currentPlatform} />
									{formatViewers(streamer.viewerCount)}
								</ViewerCount>
							</TopRow>
							<Game $platform={currentPlatform} title={`${streamer.gameName}`}>
								{streamer.gameName ?? "Unknown"}
							</Game>
						</StreamerInfo>
					</StreamerItem>
				))}
			</StreamerList>
		</Container>
	);
}
