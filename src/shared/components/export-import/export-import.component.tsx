import type WorkerService from "$shared/worker/worker.service.ts";
import type { CommonEvents } from "$types/platforms/common.events.ts";
import type { PlatformSettings } from "$types/shared/worker/settings-worker.types.ts";
import type { PlatformType, WatchtimeRecord } from "$types/shared/worker/worker.types.ts";
import type { Emitter } from "nanoevents";
import { useEffect, useState } from "preact/hooks";
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

	background: #1f1f1f;

	color: ${(props) => (props.type === "success" ? "#66bb6a" : "#ff5252")};

	border: 1px solid ${(props) => (props.type === "success" ? "rgba(102, 187, 106, 0.3)" : "rgba(255, 82, 82, 0.3)")};

	@keyframes slideIn {
		from { opacity: 0; transform: translateY(10px); }
		to { opacity: 1; transform: translateY(0); }
	}
`;

export interface ExportImportMetadata {
	version: string;
	platform: PlatformType;
	exportDate: string;
}

export interface ExportImportData {
	meta: ExportImportMetadata;
	settings: Record<string, unknown>;
	watchtime: WatchtimeRecord[];
}

interface ExportImportComponentProps {
	platform: PlatformType;
	workerService: WorkerService;
	emitter: Emitter<CommonEvents>;
}

export function ExportImportComponent({ platform, workerService, emitter }: ExportImportComponentProps) {
	const [loading, setLoading] = useState(false);
	const [status, setStatus] = useState<{ message: string; type: "success" | "error" } | null>(null);

	useEffect(() => {
		if (!status) return;

		const timer = setTimeout(() => {
			setStatus(null);
		}, 5000);

		return () => clearTimeout(timer);
	}, [status]);

	const showStatus = (message: string, type: "success" | "error") => {
		setStatus({ message, type });
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
				meta: {
					version: window.enhancer.version,
					platform,
					exportDate: new Date().toISOString(),
				},
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

			// Parse JSON with specific error handling
			let data: ExportImportData;
			try {
				data = JSON.parse(text);
			} catch (parseError) {
				showStatus("Invalid JSON format in backup file", "error");
				return;
			}

			// Validate metadata
			if (!data.meta) {
				showStatus("Invalid backup file: missing metadata", "error");
				return;
			}

			if (data.meta.platform !== platform) {
				showStatus(
					`Platform mismatch: This backup is for ${data.meta.platform}, but you're trying to import to ${platform}`,
					"error",
				);
				return;
			}

			// Validate structure
			if (!data.settings && !data.watchtime) {
				showStatus("Invalid backup file: no data found", "error");
				return;
			}

			let importedSettings = 0;
			let importedWatchtime = 0;
			let failedWatchtime = 0;

			// Import settings
			if (data.settings) {
				try {
					await workerService.send("updateSettings", { platform, settings: data.settings as PlatformSettings });
					importedSettings = Object.keys(data.settings).length;
					emitter.emit("extension:settings-refresh");
				} catch (error) {
					console.error("Failed to import settings:", error);
					showStatus("Failed to import settings", "error");
					return;
				}
			}

			// Import watchtime records concurrently with error handling
			if (data.watchtime && Array.isArray(data.watchtime)) {
				const recordsToImport = data.watchtime.filter((record) => record.platform === platform);

				const results = await Promise.allSettled(
					recordsToImport.map((record) =>
						workerService.send("importWatchtime", {
							platform,
							username: record.username,
							time: record.time,
							firstUpdate: record.firstUpdate,
							lastUpdate: record.lastUpdate,
						}),
					),
				);

				// Count successes and failures
				results.forEach((result, index) => {
					if (result.status === "fulfilled") {
						importedWatchtime++;
					} else {
						failedWatchtime++;
						console.error(`Failed to import record for ${recordsToImport[index].username}:`, result.reason);
					}
				});
			}

			// Emit watchtime refresh event if any watchtime records were imported
			if (importedWatchtime > 0) {
				emitter.emit("extension:watchtime-refresh");
			}

			// Show detailed status
			const parts = [];
			if (importedSettings > 0) {
				parts.push(`${importedSettings} settings`);
			}
			if (importedWatchtime > 0) {
				parts.push(`${importedWatchtime} watchtime records`);
			}
			if (failedWatchtime > 0) {
				parts.push(`${failedWatchtime} failed`);
			}

			const message = parts.length > 0 ? `Imported ${parts.join(", ")}` : "No data imported";
			const type = failedWatchtime > 0 && importedWatchtime === 0 ? "error" : "success";
			showStatus(message, type);
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
