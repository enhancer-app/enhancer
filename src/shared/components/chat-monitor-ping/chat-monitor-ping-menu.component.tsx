import type WorkerService from "$shared/worker/worker.service.ts";
import type { ChatMonitorKeywordMatch } from "$types/shared/chat-monitor/chat-monitor.types.ts";
import { useEffect, useState } from "preact/hooks";
import styled from "styled-components";

const Container = styled.div`
	position: fixed;
	top: 50px;
	right: 20px;
	width: 350px;
	max-height: 500px;
	background: #0d0d0d;
	border: 1px solid #232323;
	border-radius: 12px;
	box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
	z-index: 9999;
	display: flex;
	flex-direction: column;
	font-family: "Inter", "Noto Sans Arabic", "Roobert", "Helvetica Neue", Helvetica, Arial, sans-serif !important;
`;

const Header = styled.div`
	padding: 15px 20px;
	border-bottom: 1px solid #232323;
	display: flex;
	justify-content: space-between;
	align-items: center;
`;

const Title = styled.h3`
	color: #9147ff;
	font-size: 14px;
	font-weight: 600;
	margin: 0;
`;

const CloseButton = styled.button`
	background: none;
	border: none;
	color: #565656;
	cursor: pointer;
	font-size: 18px;
	padding: 0;
	width: 24px;
	height: 24px;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: color 0.2s ease;

	&:hover {
		color: #fff;
	}
`;

const MatchesList = styled.div`
	overflow-y: auto;
	max-height: 400px;

	&::-webkit-scrollbar {
		width: 8px;
	}

	&::-webkit-scrollbar-track {
		background: #0d0d0d;
		border-radius: 4px;
	}

	&::-webkit-scrollbar-thumb {
		background: #232323;
		border-radius: 4px;
		border: 1px solid #161616;
	}

	&::-webkit-scrollbar-thumb:hover {
		background: #2a2a2a;
	}
`;

const MatchItem = styled.div`
	padding: 12px 20px;
	border-bottom: 1px solid #232323;
	transition: background 0.2s ease;

	&:hover {
		background: rgba(145, 71, 255, 0.05);
	}

	&:last-child {
		border-bottom: none;
	}
`;

const MatchHeader = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 6px;
`;

const MatchChannel = styled.div`
	color: #9147ff;
	font-size: 12px;
	font-weight: 600;
`;

const MatchTime = styled.div`
	color: #565656;
	font-size: 10px;
`;

const MatchUsername = styled.div`
	color: #ccc;
	font-size: 11px;
	margin-bottom: 4px;
`;

const MatchMessage = styled.div`
	color: #999;
	font-size: 11px;
	line-height: 1.4;
	word-break: break-word;
`;

const MatchKeyword = styled.span`
	color: #9147ff;
	font-weight: 600;
`;

const EmptyState = styled.div`
	padding: 40px 20px;
	text-align: center;
	color: #565656;
	font-size: 12px;
`;

const Footer = styled.div`
	padding: 12px 20px;
	border-top: 1px solid #232323;
	display: flex;
	justify-content: center;
`;

const ClearButton = styled.button`
	background: rgba(145, 71, 255, 0.1);
	border: 1px solid rgba(145, 71, 255, 0.3);
	color: #9147ff;
	padding: 6px 16px;
	border-radius: 6px;
	font-size: 11px;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.2s ease;

	&:hover {
		background: rgba(145, 71, 255, 0.2);
		border-color: rgba(145, 71, 255, 0.4);
	}

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
`;

interface ChatMonitorPingMenuProps {
	workerService: WorkerService;
	onClose: () => void;
}

export function ChatMonitorPingMenu({ workerService, onClose }: ChatMonitorPingMenuProps) {
	const [matches, setMatches] = useState<ChatMonitorKeywordMatch[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		loadMatches();
	}, []);

	const loadMatches = async () => {
		setLoading(true);
		try {
			const response = await workerService.send("getChatMonitorMatches", { limit: 50 });
			if (response?.matches) {
				setMatches(response.matches);
			}
		} catch (error) {
			console.error("Failed to load chat monitor matches:", error);
		} finally {
			setLoading(false);
		}
	};

	const clearMatches = async () => {
		try {
			await workerService.send("clearChatMonitorMatches");
			setMatches([]);
		} catch (error) {
			console.error("Failed to clear chat monitor matches:", error);
		}
	};

	const formatTime = (timestamp: number): string => {
		const date = new Date(timestamp);
		const now = new Date();
		const diff = now.getTime() - date.getTime();

		if (diff < 60000) {
			return "Just now";
		}
		if (diff < 3600000) {
			return `${Math.floor(diff / 60000)}m ago`;
		}
		if (diff < 86400000) {
			return `${Math.floor(diff / 3600000)}h ago`;
		}
		return date.toLocaleDateString();
	};

	const highlightKeyword = (message: string, keyword: string): any => {
		const parts = message.split(new RegExp(`(${keyword})`, "gi"));
		return parts.map((part, index) =>
			part.toLowerCase() === keyword.toLowerCase() ? (
				<MatchKeyword key={`keyword-${index}-${part}`}>{part}</MatchKeyword>
			) : (
				part
			),
		);
	};

	return (
		<Container>
			<Header>
				<Title>Chat Monitor</Title>
				<CloseButton onClick={onClose}>×</CloseButton>
			</Header>

			<MatchesList>
				{matches.length === 0 ? (
					<EmptyState>{loading ? "Loading..." : "No keyword matches yet"}</EmptyState>
				) : (
					matches.map((match) => (
						<MatchItem key={`${match.platform}-${match.channel}-${match.timestamp}`}>
							<MatchHeader>
								<MatchChannel>
									{match.platform}/{match.channel}
								</MatchChannel>
								<MatchTime>{formatTime(match.timestamp)}</MatchTime>
							</MatchHeader>
							<MatchUsername>{match.username}</MatchUsername>
							<MatchMessage>{highlightKeyword(match.message, match.keyword)}</MatchMessage>
						</MatchItem>
					))
				)}
			</MatchesList>

			{matches.length > 0 && (
				<Footer>
					<ClearButton onClick={clearMatches}>Clear All</ClearButton>
				</Footer>
			)}
		</Container>
	);
}
