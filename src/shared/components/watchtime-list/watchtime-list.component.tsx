import { Logger } from "$shared/logger/logger.ts";
import type WorkerService from "$shared/worker/worker.service.ts";
import type { CommonEvents } from "$types/platforms/common.events.ts";
import type { PlatformType } from "$types/shared/worker/worker.types.ts";
import type { Emitter } from "nanoevents";
import { useEffect, useState } from "preact/hooks";
import styled from "styled-components";

const logger = new Logger({ context: "watchtime-list" });

const Container = styled.div`
	line-height: 1.6;
	color: var(--settings-text);
	width: 100%;
	background: var(--settings-surface);
	border: 1px solid var(--settings-border);
	border-radius: 12px;
	overflow: hidden;
`;

const Header = styled.div`
	padding: 16px 18px;
`;

const TitleSection = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;
	cursor: pointer;
`;

const TitleGroup = styled.div`
	display: flex;
	flex-direction: column;
	gap: 3px;
	min-width: 0;
`;

const Title = styled.span`
	color: var(--settings-text-strong);
	font-size: 13px;
	font-weight: 500;
`;

const ActionText = styled.span`
	color: var(--settings-text-muted);
	font-size: 11.5px;
	transition: color 0.15s ease;

	${TitleSection}:hover & {
		color: #9147ff;
	}
`;

const Chevron = styled.span<{ $expanded: boolean }>`
	color: var(--settings-text-muted);
	flex-shrink: 0;
	display: flex;
	transition: transform 0.2s ease, color 0.15s ease;
	transform: rotate(${(props) => (props.$expanded ? "180deg" : "0deg")});

	${TitleSection}:hover & {
		color: #9147ff;
	}
`;

const ExportSection = styled.div<{ $visible: boolean }>`
	display: ${(props) => (props.$visible ? "flex" : "none")};
	gap: 8px;
	justify-content: flex-end;
	padding: 0 18px 14px;
`;

const ExportButton = styled.button`
	background: var(--settings-control-background);
	border: 1px solid var(--settings-control-border);
	color: var(--settings-text);
	padding: 7px 14px;
	border-radius: 8px;
	font-size: 11px;
	font-weight: 500;
	cursor: pointer;
	transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;

	&:hover:not(:disabled) {
		border-color: #9147ff;
		color: #9147ff;
		background: var(--settings-control-hover);
	}

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
`;

const Content = styled.div<{ $visible: boolean }>`
	padding: 0 18px 18px;
	display: ${(props) => (props.$visible ? "block" : "none")};
`;

const TableContainer = styled.div`
	background: var(--settings-control-background);
	border: 1px solid var(--settings-border);
	border-radius: 10px;
	overflow: hidden;
`;

const Table = styled.table`
	width: 100%;
	border-collapse: collapse;
`;

const TableHeader = styled.thead`
	background: var(--settings-control-hover);
`;

const TableHeaderRow = styled.tr`
	border-bottom: 1px solid var(--settings-border);
`;

const TableHeaderCell = styled.th`
	padding: 12px 16px;
	text-align: left;
	color: #9147ff;
	font-size: 11px;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.4px;
`;

const PositionHeaderCell = styled(TableHeaderCell)`
	width: 64px;
	text-align: center;
`;

const TableBody = styled.tbody``;

const TableRow = styled.tr`
	border-bottom: 1px solid var(--settings-divider-subtle);
	transition: background 0.15s ease;

	&:hover {
		background: rgba(145, 71, 255, 0.05);
	}

	&:last-child {
		border-bottom: none;
	}
`;

const TableCell = styled.td`
	padding: 11px 16px;
	font-size: 11.5px;
	color: var(--settings-text);
`;

const PositionCell = styled(TableCell)`
	text-align: center;
	color: var(--settings-text-dim);
	font-weight: 600;
	width: 64px;
`;

const UsernameCell = styled(TableCell)`
	font-weight: 500;
`;

const UsernameLink = styled.a`
	color: #9147ff !important;
	text-decoration: none;
	transition: color 0.15s ease;

	&:hover {
		color: #b887ff;
		text-decoration: underline;
	}
`;

const PaginationSection = styled.div`
	display: flex;
	justify-content: center;
	align-items: center;
	gap: 12px;
	margin-top: 16px;
`;

const PageButton = styled.button`
	background: var(--settings-control-background);
	border: 1px solid var(--settings-control-border);
	color: var(--settings-text);
	padding: 7px 14px;
	border-radius: 8px;
	font-size: 11px;
	font-weight: 500;
	cursor: pointer;
	transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;

	&:hover:not(:disabled) {
		border-color: #9147ff;
		color: #9147ff;
		background: var(--settings-control-hover);
	}

	&:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
`;

const PageInfo = styled.span`
	color: var(--settings-text-muted);
	font-size: 11px;
`;

const LoadingText = styled.div`
	text-align: center;
	color: var(--settings-text-muted);
	font-size: 11.5px;
	padding: 24px;
`;

const ChevronIcon = () => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width="16"
		height="16"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		strokeLinecap="round"
		strokeLinejoin="round"
	>
		<path d="M6 9l6 6 6-6" />
	</svg>
);

export interface PaginatedWatchtimeResponse {
	data: WatchtimeRecord[];
	page: number;
	pageSize: number;
	total: number;
}

export interface WatchtimeRecord {
	id: string;
	platform: PlatformType;
	username: string;
	time: number;
	firstUpdate: number;
	lastUpdate: number;
}

interface WatchtimeListComponentProps {
	platform: PlatformType;
	pageSize?: number;
	workerService: WorkerService;
	emitter?: Emitter<CommonEvents>;
}

export function WatchtimeListComponent({
	platform,
	pageSize = 5,
	workerService,
	emitter,
}: WatchtimeListComponentProps) {
	const [expanded, setExpanded] = useState(false);
	const [currentPage, setCurrentPage] = useState(1);
	const [data, setData] = useState<PaginatedWatchtimeResponse | null>(null);
	const [loading, setLoading] = useState(false);
	const [exporting, setExporting] = useState(false);

	const fetchPage = async (page: number): Promise<PaginatedWatchtimeResponse | null> => {
		const response = await workerService.send("getPaginatedWatchtime", {
			platform,
			page,
			pageSize,
		});
		return response || null;
	};

	const fetchAllData = async (): Promise<WatchtimeRecord[]> => {
		const allData: WatchtimeRecord[] = [];
		let currentPageNum = 1;
		let hasMore = true;

		try {
			while (hasMore) {
				const response = await fetchPage(currentPageNum);
				if (response && response.data.length > 0) {
					allData.push(...response.data);
					hasMore = response.data.length === pageSize;
					currentPageNum++;
				} else {
					hasMore = false;
				}
			}
			return allData;
		} catch (error) {
			logger.error("Error fetching all watchtime data:", error);
			return allData;
		}
	};

	const loadData = async (page: number) => {
		setLoading(true);
		const response = await fetchPage(page);
		if (response) {
			setData(response);
		}
		setLoading(false);
	};

	useEffect(() => {
		if (expanded && !data) {
			loadData(1);
		}
	}, [expanded]);

	useEffect(() => {
		if (!emitter) return;

		const handleWatchtimeRefresh = async () => {
			if (expanded) {
				await loadData(1);
				setCurrentPage(1);
			}
		};

		const unbind = emitter.on("extension:watchtime-refresh", handleWatchtimeRefresh);

		return () => {
			unbind();
		};
	}, [emitter, expanded, loadData, setCurrentPage]);

	const handleNextPage = async () => {
		if (data && data.data.length === pageSize) {
			setCurrentPage(currentPage + 1);
			await loadData(currentPage + 1);
		}
	};

	const handlePrevPage = async () => {
		if (currentPage > 1) {
			setCurrentPage(currentPage - 1);
			await loadData(currentPage - 1);
		}
	};

	const formatTime = (seconds: number): string => {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = seconds % 60;
		return `${hours}h ${minutes}m ${secs}s`;
	};

	const formatDate = (timestamp: number): string => {
		return new Date(timestamp).toLocaleDateString();
	};

	const getPlatformUrl = (username: string): string => {
		return platform === "twitch" ? `https://twitch.tv/${username}` : `https://kick.com/${username}`;
	};

	const getPosition = (index: number): number => {
		return (currentPage - 1) * pageSize + index + 1;
	};

	const exportToTxt = async () => {
		setExporting(true);
		try {
			const allData = await fetchAllData();
			const content = allData.map((record) => `${record.username},${record.time}`).join("\n");
			const blob = new Blob([content], { type: "text/plain" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `watchtime-${platform}-all.txt`;
			a.click();
			URL.revokeObjectURL(url);
		} finally {
			setExporting(false);
		}
	};

	const exportToExcel = async () => {
		setExporting(true);
		try {
			const allData = await fetchAllData();
			const headers = "Position,Username,Seconds,First Watched,Last Watched\n";
			const content = allData
				.map((record, index) => {
					const position = index + 1;
					const seconds = record.time;
					const firstUpdate = new Date(record.firstUpdate).toLocaleString();
					const lastUpdate = new Date(record.lastUpdate).toLocaleString();
					return `${position},${record.username},${seconds},"${firstUpdate}","${lastUpdate}"`;
				})
				.join("\n");

			const csvContent = headers + content;
			const blob = new Blob([csvContent], { type: "text/csv" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `watchtime-${platform}-all.csv`;
			a.click();
			URL.revokeObjectURL(url);
		} finally {
			setExporting(false);
		}
	};

	return (
		<Container>
			<Header>
				<TitleSection onClick={() => setExpanded(!expanded)}>
					<TitleGroup>
						<Title>Watchtime List</Title>
						<ActionText>{expanded ? "Click to hide" : "Click to see your watchtime"}</ActionText>
					</TitleGroup>
					<Chevron $expanded={expanded}>
						<ChevronIcon />
					</Chevron>
				</TitleSection>
			</Header>

			<ExportSection $visible={expanded && !!data}>
				<ExportButton onClick={exportToTxt} disabled={exporting}>
					{exporting ? "Exporting..." : "Export TXT"}
				</ExportButton>
				<ExportButton onClick={exportToExcel} disabled={exporting}>
					{exporting ? "Exporting..." : "Export CSV"}
				</ExportButton>
			</ExportSection>

			<Content $visible={expanded}>
				{loading && <LoadingText>Loading watchtime data...</LoadingText>}

				{data && (
					<>
						<TableContainer>
							<Table>
								<TableHeader>
									<TableHeaderRow>
										<PositionHeaderCell>#</PositionHeaderCell>
										<TableHeaderCell>Username</TableHeaderCell>
										<TableHeaderCell>Watch Time</TableHeaderCell>
									</TableHeaderRow>
								</TableHeader>
								<TableBody>
									{data.data.map((record, index) => (
										<TableRow key={record.id}>
											<PositionCell>{getPosition(index)}</PositionCell>
											<UsernameCell>
												<UsernameLink href={getPlatformUrl(record.username)} target="_blank" rel="noopener noreferrer">
													{record.username}
												</UsernameLink>
											</UsernameCell>
											<TableCell>{formatTime(record.time)}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</TableContainer>

						<PaginationSection>
							<PageButton onClick={handlePrevPage} disabled={currentPage === 1}>
								Previous
							</PageButton>

							<PageInfo>Page {currentPage}</PageInfo>

							<PageButton onClick={handleNextPage} disabled={!data || data.data.length < pageSize}>
								Next
							</PageButton>
						</PaginationSection>
					</>
				)}
			</Content>
		</Container>
	);
}
