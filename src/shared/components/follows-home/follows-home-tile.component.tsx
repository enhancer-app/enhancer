import { MarqueeTextComponent } from "$shared/components/marquee-text/marquee-text.component.tsx";
import { StreamPreviewComponent } from "$shared/components/stream-preview/stream-preview.component.tsx";
import {
	AvatarPlatformDot,
	LinkedPlatformIcon,
	channelThumbnailUrl,
	formatUptime,
	formatViewers,
	PinIcon,
	PLATFORM_COLORS,
	PLATFORM_NAMES,
	PLATFORM_URLS,
} from "$shared/components/cross-platform-follows/platform.shared.tsx";
import { getFollowEntryKey } from "$shared/utils/follows-links.utils.ts";
import { HOME_ANIMATION_KEY, HOME_LIVE_BADGE } from "$shared/utils/follows-home-animation.utils.ts";
import { getPlaylistFetcher } from "$shared/utils/playlist-proxy.utils.ts";
import type { FollowsHomeTileProps } from "$types/shared/components/follows-home.component.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import { useEffect, useRef, useState } from "preact/hooks";
import styled, { css, keyframes } from "styled-components";

const HOVER_DELAY_MS = 300;

async function resolvePreviewUrl(platform: PlatformType, login: string): Promise<string | null> {
	const response = await chrome.runtime.sendMessage({ action: "getStreamPlaybackUrl", payload: { platform, login } });
	return typeof response?.url === "string" ? response.url : null;
}

export function FollowsHomeTileComponent({
	channel,
	now,
	onNavigate,
	onTogglePin,
	onContextMenu,
}: FollowsHomeTileProps) {
	const [hovered, setHovered] = useState(false);
	const [pointerInside, setPointerInside] = useState(false);
	const [playing, setPlaying] = useState(false);
	const [previewFailed, setPreviewFailed] = useState(false);
	const [thumbnailFailed, setThumbnailFailed] = useState(false);
	const timer = useRef<number | null>(null);
	const url = PLATFORM_URLS[channel.platform](channel.login);
	const thumbnail = channelThumbnailUrl(channel.platform, channel, channel.checkedAt);

	useEffect(() => () => clearHoverTimer(), []);
	useEffect(() => setThumbnailFailed(false), [thumbnail]);

	function clearHoverTimer() {
		if (timer.current !== null) window.clearTimeout(timer.current);
		timer.current = null;
	}

	const handleEnter = () => {
		clearHoverTimer();
		timer.current = window.setTimeout(() => setHovered(true), HOVER_DELAY_MS);
	};

	const handleLeave = () => {
		clearHoverTimer();
		setHovered(false);
		setPlaying(false);
		setPreviewFailed(false);
	};

	return (
		<Tile
			{...{ [HOME_ANIMATION_KEY]: `live:${getFollowEntryKey(channel)}` }}
			$accent={PLATFORM_COLORS[channel.platform]}
			onContextMenu={(event: MouseEvent) => {
				if (event.shiftKey) return;
				event.preventDefault();
				onContextMenu(event, channel);
			}}
			onMouseEnter={() => setPointerInside(true)}
			onMouseLeave={() => setPointerInside(false)}
		>
			<Media
				href={url}
				target="_top"
				onMouseEnter={handleEnter}
				onMouseLeave={handleLeave}
				onClick={(event) => onNavigate(url, event)}
				aria-label={`${channel.displayName} on ${PLATFORM_NAMES[channel.platform]}`}
			>
				{thumbnail && !thumbnailFailed ? (
					<Thumbnail src={thumbnail} alt="" loading="lazy" onError={() => setThumbnailFailed(true)} />
				) : (
					<ThumbnailFallback>{channel.avatarUrl && <img src={channel.avatarUrl} alt="" />}</ThumbnailFallback>
				)}
				{hovered && (
					<StreamPreviewComponent
						platform={channel.platform}
						login={channel.login}
						resolveUrl={resolvePreviewUrl}
						playlistFetcher={getPlaylistFetcher(channel.platform)}
						onPlaying={() => setPlaying(true)}
						onFailed={() => setPreviewFailed(true)}
					/>
				)}
				<Shade $visible={hovered && playing} />
				{hovered && !playing && !previewFailed && <Loader />}
				<LiveBadge {...{ [HOME_LIVE_BADGE]: "" }}>LIVE</LiveBadge>
				{onTogglePin && (
					<PinButton
						type="button"
						$pinned={channel.pinned}
						aria-label={channel.pinned ? "Unpin channel" : "Pin channel"}
						title={channel.pinned ? "Unpin channel" : "Pin channel"}
						onClick={(event) => {
							event.preventDefault();
							event.stopPropagation();
							onTogglePin(channel);
						}}
					>
						<PinIcon filled={channel.pinned} size={14} />
					</PinButton>
				)}
				<Stat $side="left">{formatViewers(channel.viewers)} viewers</Stat>
				{channel.startedAt && <Stat $side="right">{formatUptime(channel.startedAt, now)}</Stat>}
			</Media>
			<Info>
				<AvatarWrap>
					<Avatar href={url} target="_top" onClick={(event) => onNavigate(url, event)} tabIndex={-1}>
						{channel.avatarUrl ? <img src={channel.avatarUrl} alt="" /> : <span>{channel.displayName[0]}</span>}
					</Avatar>
					<AvatarPlatformDot
						$platform={channel.platform}
						$linked={!!channel.linked}
						$size={14}
						$border="var(--page-background)"
						title={channel.linked ? "Linked Twitch and Kick channels" : PLATFORM_NAMES[channel.platform]}
					>
						{channel.linked && <LinkedPlatformIcon />}
					</AvatarPlatformDot>
				</AvatarWrap>
				<Text>
					<Title>
						<MarqueeTextComponent text={channel.title || "Untitled stream"} active={pointerInside} />
					</Title>
					<Name href={url} target="_top" onClick={(event) => onNavigate(url, event)}>
						<span>{channel.displayName}</span>
					</Name>
					{channel.category && (
						<Category>
							<MarqueeTextComponent text={channel.category} active={pointerInside} />
						</Category>
					)}
				</Text>
			</Info>
		</Tile>
	);
}

const spin = keyframes`
	to { transform: rotate(360deg); }
`;

const Tile = styled.article<{ $accent: string }>`
	--accent: ${(props) => props.$accent};
	display: flex;
	flex-direction: column;
	gap: 10px;
	min-width: 0;
`;

const Media = styled.a`
	position: relative;
	display: block;
	aspect-ratio: 16 / 9;
	overflow: hidden;
	border-radius: 6px;
	background: #161616;
	outline: none;
	transition:
		transform 0.15s ease,
		box-shadow 0.15s ease;

	&:hover,
	&:focus-visible {
		transform: translate(4px, -4px);
		box-shadow: -4px 4px 0 var(--accent);
	}

	&:hover button,
	&:focus-visible button {
		opacity: 1;
	}
`;

const coverStyles = css`
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
`;

const Thumbnail = styled.img`
	${coverStyles};
`;

const ThumbnailFallback = styled.div`
	${coverStyles};
	display: flex;
	align-items: center;
	justify-content: center;
	background: radial-gradient(circle at center, #232323, #121212);

	img {
		width: 56px;
		height: 56px;
		border-radius: 50%;
	}
`;

const Shade = styled.div<{ $visible: boolean }>`
	position: absolute;
	inset: 0;
	pointer-events: none;
	background: linear-gradient(to top, rgba(0, 0, 0, 0.55), transparent 35%);
	opacity: ${(props) => (props.$visible ? 0.4 : 1)};
	transition: opacity 0.2s ease;
`;

const Loader = styled.div`
	position: absolute;
	top: calc(50% - 14px);
	left: calc(50% - 14px);
	width: 28px;
	height: 28px;
	border: 3px solid rgba(255, 255, 255, 0.25);
	border-top-color: var(--accent);
	border-radius: 50%;
	animation: ${spin} 0.8s linear infinite;
`;

const LiveBadge = styled.span`
	position: absolute;
	top: 8px;
	left: 8px;
	padding: 1px 6px;
	border-radius: 4px;
	background: #eb0400;
	color: white;
	font-size: 12px;
	font-weight: 700;
	letter-spacing: 0.02em;
`;

const Stat = styled.span<{ $side: "left" | "right" }>`
	position: absolute;
	bottom: 8px;
	${(props) => props.$side}: 8px;
	padding: 1px 6px;
	border-radius: 4px;
	background: rgba(0, 0, 0, 0.65);
	color: white;
	font-size: 12px;
	font-variant-numeric: tabular-nums;
`;

const Info = styled.div`
	display: flex;
	gap: 10px;
	min-width: 0;
`;

const AvatarWrap = styled.span`
	position: relative;
	flex-shrink: 0;
	align-self: flex-start;
`;

const Avatar = styled.a`
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 40px;
	height: 40px;
	overflow: hidden;
	border-radius: 50%;
	background: #232323;
	color: white;
	font-weight: 700;

	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
`;

const Text = styled.div`
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
`;

const Title = styled.p`
	margin: 0;
	color: white;
	font-size: 14px;
	font-weight: 600;
	line-height: 1.3;
`;

const Name = styled.a`
	display: flex;
	align-items: center;
	gap: 6px;
	min-width: 0;
	color: #ccc;
	font-size: 13px;
	text-decoration: none;

	> span:first-child {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	&:hover {
		color: var(--accent);
	}
`;

const Category = styled.div`
	min-width: 0;
	color: #8a8a8a;
	font-size: 13px;
`;

const PinButton = styled.button<{ $pinned: boolean }>`
	position: absolute;
	top: 8px;
	right: 8px;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	padding: 0;
	border: none;
	border-radius: 4px;
	cursor: pointer;
	background: ${(props) => (props.$pinned ? "rgba(145, 71, 255, 0.5)" : "rgba(0, 0, 0, 0.4)")};
	color: white;
	opacity: ${(props) => (props.$pinned ? 1 : 0)};
	transition: all 0.2s ease;

	&:hover {
		background: ${(props) => (props.$pinned ? "rgba(145, 71, 255, 0.7)" : "rgba(0, 0, 0, 0.6)")};
		transform: scale(1.05);
	}
`;
