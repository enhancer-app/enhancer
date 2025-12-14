import type WorkerService from "$shared/worker/worker.service.ts";
import type { CommonEvents } from "$types/platforms/common.events.ts";
import type { WatchtimeRecord } from "$types/shared/worker/worker.types.ts";
import type { Emitter } from "nanoevents";
import { useState } from "preact/hooks";
import styled from "styled-components";

const Container = styled.div`
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	gap: 24px;
	width: 100%;
	padding: 10px 0;
`;

const InfoSection = styled.div`
	display: flex;
	flex-direction: column;
	gap: 4px;
	flex: 1;
`;

const InfoTitle = styled.span`
	color: #e0e0e0;
	font-size: 13px;
	font-weight: 600;
	letter-spacing: 0.5px;
`;

const InfoDescription = styled.span`
	color: #888;
	font-size: 11px;
`;

const PlatformTag = styled.span`
	color: #b887ff;
	font-weight: 600;
	text-transform: capitalize;
`;

const ButtonGroup = styled.div`
	display: flex;
	gap: 12px;
	flex-shrink: 0;
	padding-left: 24px;
	border-left: 1px solid rgba(255, 255, 255, 0.1);
`;

const ActionButton = styled.button`
	background: rgba(145, 71, 255, 0.1);
	border: 1px solid rgba(145, 71, 255, 0.3);
	color: #b887ff;
	padding: 8px 20px;
	border-radius: 6px;
	font-size: 12px;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.2s ease;
	min-width: 120px;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;

	&:hover:not(:disabled) {
		background: rgba(145, 71, 255, 0.2);
		border-color: rgba(145, 71, 255, 0.5);
		color: #fff;
		transform: translateY(-1px);
	}

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none;
	}
`;

const FileInput = styled.input`
	display: none;
`;

const StatusOverlay = styled.div<{ type: "success" | "error" }>`
	position: fixed;
	bottom: 20px;
	right: 20px;
	padding: 12px 24px;
	border-radius: 8px;
	font-size: 13px;
	font-weight: 500;
	z-index: 100;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	animation: slideIn 0.3s ease;

	background: ${(props) => (props.type === "success" ? "#1f1f1f" : "#1f1f1f")};

	color: ${(props) => (props.type === "success" ? "#66bb6a" : "#ff5252")};

	border: 1px solid ${(props) => (props.type === "success" ? "rgba(102, 187, 106, 0.3)" : "rgba(255, 82, 82, 0.3)")};

	@keyframes slideIn {
		from { opacity: 0; transform: translateY(10px); }
		to { opacity: 1; transform: translateY(0); }
	}
`;

export interface ExportImportData {
	settings: Record<string, unknown>;
	watchtime: WatchtimeRecord[];
}

export type PlatformType = "twitch" | "kick";

interface ExportImportComponentProps {
	platform: PlatformType;
	workerService: WorkerService;
	emitter: Emitter<CommonEvents>;
}

export function ExportImportComponent({ platform, workerService, emitter }: ExportImportComponentProps) {
	const [loading, setLoading] = useState(false);
	const [status, setStatus] = useState<{ message: string; type: "success" | "error" } | null>(null);

	const showStatus = (message: string, type: "success" | "error") => {
		setStatus({ message, type });
		setTimeout(() => setStatus(null), 5000);
	};

	const fetchAllWatchtime = async (platform: PlatformType): Promise<WatchtimeRecord[]> => {
		const allData: WatchtimeRecord[] = [];
		let currentPageNum = 1;
		let hasMore = true;
		const pageSize = 1000;

		try {
			while (hasMore) {
				const response = await workerService.send("getPaginatedWatchtime", {
					platform,
					page: currentPageNum,
					pageSize,
				});

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

	const exportData = async () => {
		setLoading(true);
		setStatus(null);
		try {
			const settings = await workerService.send("getSettings", { platform });
			const watchtime = await fetchAllWatchtime(platform);

			const exportData: ExportImportData = {
				settings: settings || {},
				watchtime,
			};

			const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `enhancer-${platform}-backup-${new Date().toISOString().split("T")[0]}.json`;
			a.click();
			URL.revokeObjectURL(url);

			showStatus(`Successfully exported ${platform} backup`, "success");
		} catch (error) {
			console.error("Export error:", error);
			showStatus("Failed to export data", "error");
		} finally {
			setLoading(false);
		}
	};

	const importData = async (file: File) => {
		setLoading(true);
		setStatus(null);
		try {
			const text = await file.text();
			const data: ExportImportData = JSON.parse(text);

			if (!data.settings && !data.watchtime) {
				showStatus("Invalid backup file", "error");
				return;
			}

			let importedSettings = 0;
			let importedWatchtime = 0;

			if (data.settings) {
				await workerService.send("updateSettings", { platform, settings: data.settings as any });
				importedSettings = Object.keys(data.settings).length;
				emitter.emit("extension:settings-refresh");
			}

			if (data.watchtime && Array.isArray(data.watchtime)) {
				for (const record of data.watchtime) {
					if (record.platform === platform) {
						await workerService.send("importWatchtime", {
							platform,
							username: record.username,
							time: record.time,
						});
						importedWatchtime++;
					}
				}
			}

			showStatus(`Imported ${importedSettings} settings and ${importedWatchtime} records`, "success");
		} catch (error) {
			console.error("Import error:", error);
			showStatus("Failed to import data", "error");
		} finally {
			setLoading(false);
		}
	};

	const handleFileSelect = (event: Event) => {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			importData(file);
		}
		input.value = "";
	};

	return (
		<Container>
			<InfoSection>
				<InfoTitle>Data Backup</InfoTitle>
				<InfoDescription>
					This backup handles data for <PlatformTag>{platform}</PlatformTag> only.
				</InfoDescription>
			</InfoSection>

			<ButtonGroup>
				<ActionButton onClick={exportData} disabled={loading}>
					{loading ? "Processing..." : "Export"}
				</ActionButton>

				<FileInput
					type="file"
					id={`import-${platform}`}
					accept=".json"
					onChange={handleFileSelect}
					disabled={loading}
				/>

				<ActionButton onClick={() => document.getElementById(`import-${platform}`)?.click()} disabled={loading}>
					{loading ? "Processing..." : "Import"}
				</ActionButton>
			</ButtonGroup>

			{status && <StatusOverlay type={status.type}>{status.message}</StatusOverlay>}
		</Container>
	);
}
