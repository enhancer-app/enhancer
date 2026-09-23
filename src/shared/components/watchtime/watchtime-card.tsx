import { LoadingComponent } from "$shared/components/loading/loading.component.tsx";
import type { EnhancerStreamerWatchTimeData, XayoWatchtimePeriod } from "$types/apis/enhancer.apis.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { Signal } from "@preact/signals";
import styled from "styled-components";

interface PlatformStyleProps {
	$platform: PlatformType;
}

const PERIOD_OPTIONS: { value: XayoWatchtimePeriod; label: string }[] = [
	{ value: "30d", label: "30d" },
	{ value: "365d", label: "1y" },
	{ value: "all", label: "All time" },
];

const WatchTimeItem = styled.a<PlatformStyleProps>`
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 6px;
	border-bottom: 1px solid
		${({ $platform }) => ($platform === "kick" ? "#2b2b2b" : "var(--color-border-base, #303032)")};
	transition: background-color 0.2s ease;
	text-decoration: none;
	color: inherit;
	cursor: pointer;

	&:hover {
		background-color: ${({ $platform }) =>
			$platform === "kick" ? "#1d2b1b" : "var(--color-background-button-text-hover, #232326)"};
		text-decoration: none;
	}

	&:last-child {
		border-bottom: none;
	}
`;

const TotalWatchTimeItem = styled(WatchTimeItem)<PlatformStyleProps>`
	margin-top: 8px;
	font-weight: 600;
	color: ${({ $platform }) => ($platform === "kick" ? "#53fc18" : "#bf94ff")};
	border-bottom: none;
	padding-left: 4px;

	&:hover {
		text-decoration: none;
	}
`;

const formatWatchTime = (totalMinutes: number): string => {
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	return `${hours > 0 ? `${hours}h ` : ""}${minutes}m`;
};

interface WatchTimeDisplayProps {
	watchTime: EnhancerStreamerWatchTimeData[];
	username: string;
	platform: PlatformType;
}

const WatchTimeDisplay = ({ watchTime, username, platform }: WatchTimeDisplayProps) => {
	const topFive = watchTime.slice(0, 5);
	const totalCount = watchTime.reduce((acc, item) => acc + item.minutes, 0);
	const streamerUrl = platform === "kick" ? "https://kick.com" : "https://twitch.tv";
	const profileUrl = platform === "kick" ? `https://xayo.pl/kick/${username}` : `https://xayo.pl/${username}`;

	return (
		<>
			{topFive.map((item) => (
				<WatchTimeItem
					key={item.streamerName}
					href={`${streamerUrl}/${item.streamerName}`}
					$platform={platform}
					target="_blank"
					rel="noopener noreferrer"
				>
					<span>{item.streamerName}</span>
					<span>{formatWatchTime(item.minutes)}</span>
				</WatchTimeItem>
			))}
			<TotalWatchTimeItem href={profileUrl} $platform={platform} target="_blank" rel="noopener noreferrer">
				Total watch time: {formatWatchTime(totalCount)}
			</TotalWatchTimeItem>
		</>
	);
};

const UserCardWrapper = styled.div<PlatformStyleProps>`
	background-color: ${({ $platform }) => ($platform === "kick" ? "transparent" : "var(--color-background-base, #18181b)")};
	border: none;
	border-radius: 4px;
	padding: 12px 16px;
	color: ${({ $platform }) => ($platform === "kick" ? "#efeff1" : "var(--color-text-base, #efeff1)")};
	--main-color: ${({ $platform }) => ($platform === "kick" ? "#53fc18" : "#bf94ff")};
`;

const WatchTimeHeader = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8px;
`;

const HeaderTitle = styled.strong`
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

const NoDataMessage = styled.div`
	color: #8e8e8e;
	padding: 10px 0;
`;

const HeaderControlsWrapper = styled.div`
	display: flex;
	align-items: center;
	gap: 4px;
	margin-left: auto;
	flex-shrink: 0;
`;

const PeriodSelect = styled.select<PlatformStyleProps>`
	height: 22px;
	padding: 0 4px;
	border-radius: 4px;
	border: 1px solid ${({ $platform }) => ($platform === "kick" ? "#2b2b2b" : "var(--color-border-base, #303032)")};
	background: transparent;
	color: ${({ $platform }) => ($platform === "kick" ? "#53fc18" : "#bf94ff")};
	font-size: 11px;
	font-weight: 600;
	line-height: 1;
	cursor: pointer;
	outline: none;

	&:focus {
		border-color: ${({ $platform }) => ($platform === "kick" ? "#53fc18" : "#bf94ff")};
	}

	option {
		background: ${({ $platform }) => ($platform === "kick" ? "#0d0d0d" : "var(--color-background-base, #18181b)")};
		color: ${({ $platform }) => ($platform === "kick" ? "#efeff1" : "var(--color-text-base, #efeff1)")};
	}
`;

const CollapseButton = styled.button<PlatformStyleProps>`
	width: 22px;
	height: 22px;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0;
	border: none;
	border-radius: 4px;
	background: transparent;
	color: ${({ $platform }) => ($platform === "kick" ? "#53fc18" : "#bf94ff")};
	font-size: 18px;
	line-height: 1;
	cursor: pointer;

	&:hover {
		background: ${({ $platform }) =>
			$platform === "kick" ? "#1d2b1b" : "var(--color-background-button-text-hover, #232326)"};
	}
`;

const Actions = styled.div`
	display: block;
	width: 100%;
`;

const ActionButton = styled.button<PlatformStyleProps>`
	background-color: ${({ $platform }) =>
		$platform === "kick" ? "#53fc18" : "var(--color-background-button-primary-default, #9147ff)"};
	color: ${({ $platform }) => ($platform === "kick" ? "#0d0d0d" : "var(--color-text-button-primary, #ffffff)")};
	border: none;
	border-radius: 4px;
	padding: 6px 12px;
	cursor: pointer;
	font-size: 14px;
	font-weight: 700;
	line-height: 1;
	width: 100%;
	display: block;
	text-align: center;

	&:hover {
		background-color: ${({ $platform }) =>
			$platform === "kick" ? "#6cff3a" : "var(--color-background-button-primary-hover, #772ce8)"};
	}
`;

interface UserCardProps {
	username: string;
	platform: PlatformType;
	data: Signal<undefined | EnhancerStreamerWatchTimeData[]>;
	isLoading: Signal<boolean>;
	isError: Signal<boolean>;
	isCollapsed: Signal<boolean>;
	period: Signal<XayoWatchtimePeriod>;
	onPeriodChange: (period: XayoWatchtimePeriod) => void;
	onFetch?: () => void;
	onToggleCollapse: () => void;
}

export const WatchTimeUserCard = ({
	username,
	platform,
	data,
	isLoading,
	isError,
	isCollapsed,
	period,
	onPeriodChange,
	onFetch,
	onToggleCollapse,
}: UserCardProps) => {
	const headerControls = (
		<HeaderControlsWrapper>
			<PeriodSelect
				$platform={platform}
				value={period.value}
				disabled={isLoading.value}
				aria-label="Watchtime period"
				onMouseDown={(event) => event.stopPropagation()}
				onChange={(event) => onPeriodChange((event.target as HTMLSelectElement).value as XayoWatchtimePeriod)}
			>
				{PERIOD_OPTIONS.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</PeriodSelect>
			{data.value !== undefined && (
				<CollapseButton $platform={platform} type="button" aria-label="Hide watchtime" onClick={onToggleCollapse}>
					×
				</CollapseButton>
			)}
		</HeaderControlsWrapper>
	);

	if (isCollapsed.value) {
		return (
			<UserCardWrapper $platform={platform}>
				<Actions>
					{onFetch && (
						<ActionButton $platform={platform} onClick={onFetch}>
							Click to see {username} watchtime
						</ActionButton>
					)}
				</Actions>
			</UserCardWrapper>
		);
	}

	if (isLoading.value) {
		return (
			<UserCardWrapper $platform={platform}>
				<WatchTimeHeader>
					<HeaderTitle>Watchtime of {username}:</HeaderTitle>
					{headerControls}
				</WatchTimeHeader>
				<LoadingComponent text="Fetching data from xayo.pl..." />
			</UserCardWrapper>
		);
	}

	if (isError.value) {
		return (
			<UserCardWrapper $platform={platform}>
				<WatchTimeHeader>
					<HeaderTitle>Watchtime of {username}:</HeaderTitle>
					{headerControls}
				</WatchTimeHeader>
				<p>An unexpected error occurred and we are sorry about that :(</p>
				<p>Please try again later.</p>
				{onFetch && (
					<Actions>
						<ActionButton $platform={platform} onClick={onFetch}>
							Retry
						</ActionButton>
					</Actions>
				)}
			</UserCardWrapper>
		);
	}

	const watchTime = data.value;
	if (watchTime === undefined) {
		return (
			<UserCardWrapper $platform={platform}>
				<Actions>
					{onFetch && (
						<ActionButton $platform={platform} onClick={onFetch}>
							Click to see {username} watchtime
						</ActionButton>
					)}
				</Actions>
			</UserCardWrapper>
		);
	}

	return (
		<UserCardWrapper $platform={platform}>
			<WatchTimeHeader>
				<HeaderTitle>Watchtime of {username}:</HeaderTitle>
				{headerControls}
			</WatchTimeHeader>
			{watchTime.length === 0 ? (
				<NoDataMessage>No watchtime data available.</NoDataMessage>
			) : (
				<WatchTimeDisplay watchTime={watchTime} username={username} platform={platform} />
			)}
		</UserCardWrapper>
	);
};

export const WatchTimePopupLoadingMessage = () => {
	return <LoadingComponent text="Fetching data from xayo.pl..." />;
};

const PopupErrorText = styled.div`
	color: #8e8e8e;
	font-size: 13px;
`;

export const WatchTimePopupErrorMessage = () => {
	return (
		<PopupErrorText>
			An unexpected error occurred and we are sorry about that :( <br />
			Please try again later.
		</PopupErrorText>
	);
};

const PopupNoDataMessage = styled.div`
	color: #8e8e8e;
	text-align: center;
	padding: 10px 0;
`;

interface WatchTimePopupProps {
	watchTime: EnhancerStreamerWatchTimeData[];
	username: string;
	platform?: PlatformType;
}

export const WatchTimePopupMessage = ({ username, watchTime, platform = "twitch" }: WatchTimePopupProps) => {
	if (!watchTime || watchTime.length === 0) {
		return <PopupNoDataMessage>No watchtime data available</PopupNoDataMessage>;
	}

	return <WatchTimeDisplay watchTime={watchTime} username={username} platform={platform} />;
};
