import { useEffect, useRef, useState } from "preact/hooks";
import styled, { css, keyframes } from "styled-components";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type {
	CrossPlatformChannel,
	CrossPlatformFollowsSnapshot,
	FollowsSortOrder,
} from "$types/shared/worker/cross-platform-follows-worker.types.ts";
import { FOLLOWS_SORT_ORDERS } from "$shared/utils/follows-sort.utils.ts";

export const PLATFORM_NAMES: Record<PlatformType, string> = { twitch: "Twitch", kick: "Kick" };

export const PLATFORM_COLORS: Record<PlatformType, string> = { twitch: "#9146ff", kick: "#53fc18" };

export const PLATFORM_URLS: Record<PlatformType, (login: string) => string> = {
	twitch: (login) => `https://www.twitch.tv/${encodeURIComponent(login)}`,
	kick: (login) => `https://kick.com/${encodeURIComponent(login)}`,
};

const ICON_ASPECT_RATIO = 0.86;

export const PlatformIcon = ({ platform, size = 14 }: { platform: PlatformType; size?: number }) =>
	platform === "kick" ? (
		<svg width={size * ICON_ASPECT_RATIO} height={size} viewBox="37 0 438 512" aria-hidden="true">
			<path
				d="M37 .036h164.448v113.621h54.71v-56.82h54.731V.036h164.448v170.777h-54.73v56.82h-54.711v56.8h54.71v56.82h54.73V512.03H310.89v-56.82h-54.73v-56.8h-54.711v113.62H37V.036z"
				fill="#53fc18"
			/>
		</svg>
	) : (
		<svg width={size * ICON_ASPECT_RATIO} height={size} viewBox="8 8 24 28" aria-hidden="true">
			<polygon points="13 8 8 13 8 31 14 31 14 36 19 31 23 31 32 22 32 8" fill="#9146ff" />
			<polygon points="26 25 30 21 30 10 14 10 14 25 18 25 18 29 22 25" fill="#fff" />
			<path d="M20 14h2v6h-2zm7 0v6h-2v-6z" fill="#9146ff" />
		</svg>
	);

export const PlatformLabel = ({ platform }: { platform: PlatformType }) => (
	<PlatformLabelBox $platform={platform}>
		<PlatformIcon platform={platform} size={10} />
		<span>{PLATFORM_NAMES[platform]}</span>
	</PlatformLabelBox>
);

const PlatformLabelBox = styled.span<{ $platform: PlatformType }>`
	flex-shrink: 0;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 4px;
	box-sizing: border-box;
	height: 18px;
	padding: 0 4px;
	border-radius: 4px;
	background: ${(props) => `${PLATFORM_COLORS[props.$platform]}26`};
	color: ${(props) => (props.$platform === "twitch" ? "#bf94ff" : PLATFORM_COLORS[props.$platform])};
	font-size: 11px;
	font-weight: 600;
	line-height: 1;

	svg {
		display: block;
		flex-shrink: 0;
	}
`;

export const LinkedPlatformIcon = () => (
	<svg viewBox="0 0 2 2" aria-hidden="true">
		<g transform="rotate(-45 1 1)">
			<path d="M0 1a1 1 0 0 1 2 0z" fill={PLATFORM_COLORS.twitch} />
			<path d="M0 1a1 1 0 0 0 2 0z" fill={PLATFORM_COLORS.kick} />
		</g>
	</svg>
);

export const AvatarPlatformDot = styled.span<{
	$platform: PlatformType;
	$size: number;
	$border: string;
	$linked?: boolean;
}>`
	position: absolute;
	right: -2px;
	bottom: -2px;
	box-sizing: border-box;
	width: ${(props) => props.$size}px;
	height: ${(props) => props.$size}px;
	border-radius: 50%;
	background: ${(props) => (props.$linked ? "none" : PLATFORM_COLORS[props.$platform])};
	border: 2px solid ${(props) => props.$border};

	svg {
		display: block;
		width: 100%;
		height: 100%;
	}
`;

export function formatViewers(viewers: number): string {
	if (viewers >= 1_000_000) return `${(viewers / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
	if (viewers >= 1_000) return `${(viewers / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
	return `${viewers}`;
}

export function formatAgo(timestamp: number, now: number): string {
	const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `${days}d ago`;
	const months = Math.floor(days / 30);
	if (months < 12) return `${months}mo ago`;
	return `${Math.floor(days / 365)}y ago`;
}

export function formatUptime(startedAt: number, now: number): string {
	const minutes = Math.max(0, Math.floor((now - startedAt) / 60_000));
	const hours = Math.floor(minutes / 60);
	return `${hours}:${(minutes % 60).toString().padStart(2, "0")}`;
}

const PROBLEM_NOTICE_DELAY_MS = 10 * 60_000;

export function getVisibleProblem(snapshot: CrossPlatformFollowsSnapshot | null | undefined, now = Date.now()) {
	if (!snapshot?.synced || !snapshot.problem) return null;
	if (snapshot.problemSince !== null && now - snapshot.problemSince < PROBLEM_NOTICE_DELAY_MS) return null;
	return snapshot.problem;
}

export function compareFollowedChannels(a: CrossPlatformChannel, b: CrossPlatformChannel): number {
	if (a.live !== b.live) return Number(b.live) - Number(a.live);
	if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
	if (a.live) return b.viewers - a.viewers;
	return (b.lastLiveAt ?? 0) - (a.lastLiveAt ?? 0) || a.displayName.localeCompare(b.displayName);
}

export function compareFewestViewersFirst(a: CrossPlatformChannel, b: CrossPlatformChannel): number {
	if (a.live && b.live && a.pinned === b.pinned) return a.viewers - b.viewers;
	return compareFollowedChannels(a, b);
}

const RECOMMENDATION_HALF_LIFE_MS = 30 * 24 * 60 * 60_000;

function recommendationScore(channel: CrossPlatformChannel, now: number): number {
	if (!channel.watchtime) return 0;
	const age = Math.max(0, now - (channel.watchedAt ?? now));
	return channel.watchtime * 0.5 ** (age / RECOMMENDATION_HALF_LIFE_MS);
}

export function compareRecommendedChannels(now: number) {
	return (a: CrossPlatformChannel, b: CrossPlatformChannel): number => {
		if (a.live !== b.live) return Number(b.live) - Number(a.live);
		if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
		return recommendationScore(b, now) - recommendationScore(a, now) || compareFollowedChannels(a, b);
	};
}

export function getFollowsComparator(sort: FollowsSortOrder, now: number) {
	if (sort === "recommended") return compareRecommendedChannels(now);
	return sort === "viewers-asc" ? compareFewestViewersFirst : compareFollowedChannels;
}

export function getFollowsSortOptions(channels: CrossPlatformChannel[]): FollowsSortOrder[] {
	const recommendationAvailable = channels.some((channel) => channel.watchtime > 0);
	return FOLLOWS_SORT_ORDERS.filter((option) => option !== "recommended" || recommendationAvailable);
}

export function channelThumbnailUrl(platform: PlatformType, channel: CrossPlatformChannel, checkedAt: number | null) {
	if (platform === "kick") return channel.thumbnailUrl;
	const base =
		channel.thumbnailUrl ??
		`https://static-cdn.jtvnw.net/previews-ttv/live_user_${encodeURIComponent(channel.login)}-440x248.jpg`;
	const bucket = Math.floor((checkedAt ?? Date.now()) / 60_000);
	return `${base}${base.includes("?") ? "&" : "?"}t=${bucket}`;
}

export function PinIcon({ filled, size = 12 }: { filled: boolean; size?: number }) {
	const previousRef = useRef(filled);
	const [toggles, setToggles] = useState(0);

	useEffect(() => {
		if (previousRef.current === filled) return;
		previousRef.current = filled;
		setToggles((count) => count + 1);
	}, [filled]);

	return (
		<Star key={toggles} aria-hidden="true" $filled={filled} $size={size} $animate={toggles > 0}>
			{filled ? "★" : "☆"}
		</Star>
	);
}

const pinPop = keyframes`
	0% { transform: scale(0.3) rotate(-72deg); opacity: 0.4; }
	60% { transform: scale(1.45) rotate(12deg); opacity: 1; }
	100% { transform: scale(1) rotate(0); }
`;

const unpinShrink = keyframes`
	0% { transform: scale(1); }
	45% { transform: scale(0.6); }
	100% { transform: scale(1); }
`;

const Star = styled.span<{ $filled: boolean; $size: number; $animate: boolean }>`
	display: inline-block;
	font-size: ${(props) => props.$size}px;
	line-height: 1;
	font-weight: ${(props) => (props.$filled ? "bold" : "normal")};
	text-shadow: ${(props) => (props.$filled ? "0 0 3px rgba(145, 71, 255, 0.5)" : "none")};
	${(props) =>
		props.$animate &&
		css`
			animation: ${props.$filled ? pinPop : unpinShrink} ${props.$filled ? 0.45 : 0.3}s
				cubic-bezier(0.34, 1.56, 0.64, 1);
		`}
`;
