import {
	channelThumbnailUrl,
	formatAgo,
	formatViewers,
	PlatformLabel,
} from "$shared/components/cross-platform-follows/platform.shared.tsx";
import { StreamPreviewComponent } from "$shared/components/stream-preview/stream-preview.component.tsx";
import { getPlaylistFetcher } from "$shared/utils/playlist-proxy.utils.ts";
import type { ChannelTooltipContentProps } from "$types/shared/components/cross-platform-follows.component.types.ts";
import { useState } from "preact/hooks";
import styled, { keyframes } from "styled-components";

export function ChannelTooltipContent({ channel, now, resolvePreviewUrl }: ChannelTooltipContentProps) {
	const [previewPlaying, setPreviewPlaying] = useState(false);
	const [previewFailed, setPreviewFailed] = useState(false);
	const thumbnail = channel.live ? channelThumbnailUrl(channel.platform, channel, now) : null;

	return (
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
				<TooltipMeta>{channel.lastLiveAt ? `Live ${formatAgo(channel.lastLiveAt, now)}` : "Offline"}</TooltipMeta>
			)}
		</TooltipContent>
	);
}

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
