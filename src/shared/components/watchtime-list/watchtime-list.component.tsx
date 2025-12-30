import type { Emitter } from "nanoevents";
import { useEffect, useState } from "preact/hooks";
import styled from "styled-components";
import type WorkerService from "$shared/worker/worker.service.ts";
import type { CommonEvents } from "$types/platforms/common.events.ts";
import type { PlatformType } from "$types/shared/worker/worker.types.ts";

const Container = styled.div`
	padding: 0;
	line-height: 1.6;
	color: #ccc;
	width: 100%;
	max-width: none;
`;

const Header = styled.div`
	padding: 20px 30px;
	background: linear-gradient(
		135deg,
		rgba(145, 71, 255, 0.1) 0%,
		rgba(145, 71, 255, 0.05) 100%
	);
	border-radius: 12px;
	border: 1px solid rgba(145, 71, 255, 0.2);
`;

const TitleSection = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
	cursor: pointer;
	transition: all 0.2s ease;

	&:hover {
		transform: translateY(-1px);
	}
`;

const Title = styled.h1`
	color: #9147ff;
	margin: 0 0 4px 0;
	font-size: 20px;
	font-weight: 700;
	text-shadow: 0 0 20px rgba(145, 71, 255, 0.3);
`;

const ActionText = styled.span`
	color: #999;
	font-size: 11px;
	font-weight: 500;
	transition: color 0.2s ease;

	${TitleSection}:hover & {
		color: #b147ff;
	}
`;

const ExportSection = styled.div<{ $visible: boolean }>`
	display: ${(props) => (props.$visible ? "flex" : "none")};
	margin-top: 20px;
	gap: 12px;
	justify-content: center;
	margin-bottom: 20px;
	padding: 0 20px;
`;

const ExportButton = styled.button`
	background: rgba(145, 71, 255, 0.1);
	border: 1px solid rgba(145, 71, 255, 0.3);
	color: #9147ff;
	padding: 8px 16px;
	border-radius: 6px;
	font-size: 10px;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.2s ease;

	&:hover:not(:disabled) {
		background: rgba(145, 71, 255, 0.2);
		border-color: rgba(145, 71, 255, 0.4);
		transform: translateY(-1px);
	}

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none;
	}
`;

const Content = styled.div<{ $visible: boolean }>`
	padding: 0 20px;
	display: ${(props) => (props.$visible ? "block" : "none")};
`;

const TableContainer = styled.div`
	background: rgba(255, 255, 255, 0.02);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 12px;
	overflow: hidden;
	margin-bottom: 25px;
`;

const Table = styled.table`
	width: 100%;
	border-collapse: collapse;
`;

const TableHeader = styled.thead`
	background: rgba(145, 71, 255, 0.1);
`;

const TableHeaderRow = styled.tr`
	border-bottom: 1px solid rgba(145, 71, 255, 0.2);
`;

const TableHeaderCell = styled.th`
	padding: 16px 20px;
	text-align: left;
	color: #9147ff;
	font-size: 12px;
	font-weight: 600;
	border-right: 1px solid rgba(255, 255, 255, 0.05);

	&:last-child {
		border-right: none;
	}
`;

const PositionHeaderCell = styled(TableHeaderCell)`
	width: 80px;
	text-align: center;
`;

const TableBody = styled.tbody``;

const TableRow = styled.tr`
	border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	transition: all 0.2s ease;

	&:hover {
		background: rgba(145, 71, 255, 0.05);
	}

	&:last-child {
		border-bottom: none;
	}
`;

const TableCell = styled.td`
	padding: 14px 20px;
	font-size: 11px;
	color: #e0e0e0;
	border-right: 1px solid rgba(255, 255, 255, 0.05);

	&:last-child {
		border-right: none;
	}
`;

const PositionCell = styled(TableCell)`
	text-align: center;
	color: #999;
	font-weight: 600;
	width: 80px;
`;

const UsernameCell = styled(TableCell)`
	color: #9147ff;
	font-weight: 600;
	font-size: 12px;
`;

const UsernameLink = styled.a`
	color: #b887ff !important;
	text-decoration: none;
	transition: all 0.2s ease;

	&:hover {
		color: #b147ff;
		text-decoration: underline;
	}
`;

const PaginationSection = styled.div`
	display: flex;
	justify-content: center;
	align-items: center;
	gap: 15px;
	margin-top: 25px;
`;

const PageButton = styled.button`
	background: rgba(145, 71, 255, 0.1);
	border: 1px solid rgba(145, 71, 255, 0.3);
	color: #9147ff;
	padding: 8px 16px;
	border-radius: 6px;
	font-size: 11px;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.2s ease;

	&:hover:not(:disabled) {
		background: rgba(145, 71, 255, 0.2);
		border-color: rgba(145, 71, 255, 0.4);
		transform: translateY(-1px);
	}

	&:disabled {
		opacity: 0.3;
		cursor: not-allowed;
		transform: none;
	}
`;

const PageInfo = styled.span`
	color: #ccc;
	font-size: 11px;
`;

const LoadingText = styled.div`
	text-align: center;
	color: #999;
	font-size: 11px;
	padding: 20px;
`;

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
			console.error("Error fetching all watchtime data:", error);
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
					<Title>Watchtime List</Title>
					<ActionText>{expanded ? "Click to hide" : "Click to see your watchtime"}</ActionText>
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
