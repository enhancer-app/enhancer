import { LoadingComponent } from "$shared/components/loading/loading.component.tsx";
import type { EnhancerStreamerWatchTimeData } from "$types/apis/enhancer.apis.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { Signal } from "@preact/signals";
import styled from "styled-components";

interface PlatformStyleProps {
	$platform: PlatformType;
}

interface UserCardStyleProps extends PlatformStyleProps {
	$collapsed: boolean;
}

const WatchTimeItem = styled.a<PlatformStyleProps>`
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 6px;
	border-bottom: 1px solid ${({ $platform }) => ($platform === "kick" ? "#2b2b2b" : "#303032")};
	transition: background-color 0.2s ease;
	text-decoration: none;
	color: inherit;
	cursor: pointer;

	&:hover {
		background-color: ${({ $platform }) => ($platform === "kick" ? "#1d2b1b" : "#232326")};
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
			<TotalWatchTimeItem
				href={`https://xayo.pl/${username}`}
				$platform={platform}
				target="_blank"
				rel="noopener noreferrer"
			>
				Total watch time: {formatWatchTime(totalCount)}
			</TotalWatchTimeItem>
		</>
	);
};

const UserCardWrapper = styled.div<UserCardStyleProps>`
	position: relative;
	background-color: ${({ $platform }) => ($platform === "kick" ? "transparent" : "#18181b")};
	border: none;
	border-radius: 4px;
	padding: ${({ $collapsed }) => ($collapsed ? "4px 32px 4px 8px" : "12px 32px 32px 16px")};
	color: #efeff1;
	--main-color: ${({ $platform }) => ($platform === "kick" ? "#53fc18" : "#bf94ff")};
`;

const CollapseButton = styled.button<PlatformStyleProps>`
	position: absolute;
	right: 6px;
	bottom: 6px;
	width: 22px;
	height: 22px;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0;
	border: none;
	border-radius: 4px;
	background: transparent;
	color: ${({ $platform }) => ($platform === "kick" ? "#53fc18" : "#bf94ff")};
	cursor: pointer;

	&:hover {
		background: ${({ $platform }) => ($platform === "kick" ? "#1d2b1b" : "#232326")};
	}
`;

const CollapseIcon = styled.span<{ $collapsed: boolean }>`
	width: 7px;
	height: 7px;
	border-right: 2px solid currentColor;
	border-bottom: 2px solid currentColor;
	transform: ${({ $collapsed }) => ($collapsed ? "rotate(225deg)" : "rotate(45deg)")};
	transition: transform 0.2s ease;
`;

const Actions = styled.div`
	display: block;
	width: 100%;
`;

const ActionButton = styled.button<PlatformStyleProps>`
	background-color: ${({ $platform }) => ($platform === "kick" ? "#53fc18" : "#9147ff")};
	color: ${({ $platform }) => ($platform === "kick" ? "#0d0d0d" : "#ffffff")};
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
		background-color: ${({ $platform }) => ($platform === "kick" ? "#6cff3a" : "#9147ff")};
		filter: ${({ $platform }) => ($platform === "kick" ? "none" : "brightness(1.1)")};
	}
`;

interface UserCardProps {
	username: string;
	platform: PlatformType;
	data: Signal<undefined | EnhancerStreamerWatchTimeData[]>;
	isLoading: Signal<boolean>;
	isError: Signal<boolean>;
	isCollapsed: Signal<boolean>;
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
	onFetch,
	onToggleCollapse,
}: UserCardProps) => {
	const collapseButton = (
		<CollapseButton
			$platform={platform}
			type="button"
			aria-label={isCollapsed.value ? "Expand watchtime" : "Collapse watchtime"}
			aria-expanded={!isCollapsed.value}
			onClick={onToggleCollapse}
		>
			<CollapseIcon $collapsed={isCollapsed.value} />
		</CollapseButton>
	);

	if (isCollapsed.value) {
		return (
			<UserCardWrapper $platform={platform} $collapsed>
				{collapseButton}
			</UserCardWrapper>
		);
	}

	if (isLoading.value) {
		return (
			<UserCardWrapper $platform={platform} $collapsed={false}>
				<LoadingComponent text="Fetching data from xayo.pl..." />
				{collapseButton}
			</UserCardWrapper>
		);
	}

	if (isError.value) {
		return (
			<UserCardWrapper $platform={platform} $collapsed={false}>
				<p>An unexpected error occurred and we are sorry about that :(</p>
				<p>Please try again later.</p>
				{onFetch && (
					<Actions>
						<ActionButton $platform={platform} onClick={onFetch}>
							Retry
						</ActionButton>
					</Actions>
				)}
				{collapseButton}
			</UserCardWrapper>
		);
	}

	const watchTime = data.value;
	if (watchTime === undefined) {
		return (
			<UserCardWrapper $platform={platform} $collapsed={false}>
				<Actions>
					{onFetch && (
						<ActionButton $platform={platform} onClick={onFetch}>
							Click to see {username} watchtime
						</ActionButton>
					)}
				</Actions>
				{collapseButton}
			</UserCardWrapper>
		);
	}

	if (watchTime.length === 0) {
		return (
			<UserCardWrapper $platform={platform} $collapsed={false}>
				No watchtime data available.
				{collapseButton}
			</UserCardWrapper>
		);
	}

	return (
		<UserCardWrapper $platform={platform} $collapsed={false}>
			<strong>Watchtime of {username}:</strong>
			<WatchTimeDisplay watchTime={watchTime} username={username} platform={platform} />
			{collapseButton}
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
