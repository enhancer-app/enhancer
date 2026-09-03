import { LoadingComponent } from "$shared/components/loading/loading.component.tsx";
import type { EnhancerStreamerWatchTimeData } from "$types/apis/enhancer.apis.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import type { Signal } from "@preact/signals";
import styled from "styled-components";

interface PlatformStyleProps {
	$platform: PlatformType;
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

const UserCardWrapper = styled.div<PlatformStyleProps>`
	background-color: #18181b;
	border: 1px solid ${({ $platform }) => ($platform === "kick" ? "#2b2b2b" : "transparent")};
	border-radius: 4px;
	padding: 12px 16px;
	color: #efeff1;
	--main-color: ${({ $platform }) => ($platform === "kick" ? "#53fc18" : "#bf94ff")};
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
	onFetch?: () => void;
}

export const WatchTimeUserCard = ({ username, platform, data, isLoading, isError, onFetch }: UserCardProps) => {
	if (isLoading.value) {
		return (
			<UserCardWrapper $platform={platform}>
				<LoadingComponent text="Fetching data from xayo.pl..." />
			</UserCardWrapper>
		);
	}

	if (isError.value) {
		return (
			<UserCardWrapper $platform={platform}>
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

	if (watchTime.length === 0) {
		return <UserCardWrapper $platform={platform}>No watchtime data available.</UserCardWrapper>;
	}

	return (
		<UserCardWrapper $platform={platform}>
			<strong>Watchtime of {username}:</strong>
			<WatchTimeDisplay watchTime={watchTime} username={username} platform={platform} />
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
