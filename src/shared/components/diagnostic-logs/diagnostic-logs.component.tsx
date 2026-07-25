import { Logger } from "$shared/logger/logger.ts";
import type WorkerService from "$shared/worker/worker.service.ts";
import type { LogEntry } from "$types/shared/logger.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import { useEffect, useState } from "preact/hooks";
import styled from "styled-components";

const Container = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 24px;
	width: 100%;
	background: var(--settings-control-background);
	border: 1px solid var(--settings-border);
	border-radius: 10px;
	padding: 14px;

	@media (max-width: 620px) {
		align-items: stretch;
		flex-direction: column;
		gap: 12px;
	}
`;

const Info = styled.div`
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

const Description = styled.span`
	color: var(--settings-text-muted);
	font-size: 11.5px;
	line-height: 1.5;
`;

const Button = styled.button`
	background: var(--settings-control-background);
	border: 1px solid var(--settings-control-border);
	color: var(--settings-text);
	padding: 8px 18px;
	border-radius: 8px;
	font-size: 12px;
	font-weight: 500;
	cursor: pointer;
	min-width: 132px;
	flex-shrink: 0;

	&:hover:not(:disabled) {
		border-color: #9147ff;
		color: #9147ff;
		background: var(--settings-control-hover);
	}

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@media (max-width: 620px) {
		width: 100%;
	}
`;

const Status = styled.div<{ $error: boolean }>`
	margin-top: 8px;
	color: ${(props) => (props.$error ? "#ff5252" : "#66bb6a")};
	font-size: 11px;
`;

interface DiagnosticLogsComponentProps {
	platform: PlatformType;
	workerService: WorkerService;
}

type ExportedLogs = {
	meta: {
		version: string;
		platform: PlatformType;
		hostname: string;
		environment: string;
		exportedAt: string;
		sources: {
			main: boolean;
			bridge: boolean;
			background: boolean;
		};
	};
	logs: LogEntry[];
};

export function DiagnosticLogsComponent({ platform, workerService }: DiagnosticLogsComponentProps) {
	const [loading, setLoading] = useState(false);
	const [status, setStatus] = useState<{ message: string; error: boolean } | null>(null);

	useEffect(() => {
		if (!status) return;
		const timer = setTimeout(() => setStatus(null), 5000);
		return () => clearTimeout(timer);
	}, [status]);

	const exportLogs = async () => {
		setLoading(true);
		setStatus(null);
		try {
			const [backgroundResult, bridgeResult] = await Promise.allSettled([
				workerService.send("getLogs"),
				workerService.getBridgeLogs(),
			]);
			const backgroundLogs =
				backgroundResult.status === "fulfilled" && Array.isArray(backgroundResult.value) ? backgroundResult.value : [];
			const bridgeLogs = bridgeResult.status === "fulfilled" ? bridgeResult.value : [];
			const logs = [...Logger.getLogs(), ...bridgeLogs, ...backgroundLogs].sort(
				(first, second) => first.timestamp - second.timestamp,
			);
			const exportData: ExportedLogs = {
				meta: {
					version: window.enhancer.version,
					platform,
					hostname: window.location.hostname,
					environment: window.enhancer.environment,
					exportedAt: new Date().toISOString(),
					sources: {
						main: true,
						bridge: bridgeResult.status === "fulfilled",
						background: backgroundResult.status === "fulfilled" && backgroundResult.value !== null,
					},
				},
				logs,
			};

			const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = `enhancer-logs-${platform}-${new Date().toISOString().split("T")[0]}.json`;
			link.click();
			URL.revokeObjectURL(url);
			setStatus({ message: `Exported ${logs.length} log entries`, error: false });
		} catch {
			setStatus({ message: "Failed to export logs", error: true });
		} finally {
			setLoading(false);
		}
	};

	return (
		<div>
			<Container>
				<Info>
					<Title>Diagnostic logs</Title>
					<Description>Exports recent Enhancer logs from this tab and its background worker.</Description>
				</Info>
				<Button onClick={exportLogs} disabled={loading}>
					{loading ? "Exporting..." : "Export logs"}
				</Button>
			</Container>
			{status && <Status $error={status.error}>{status.message}</Status>}
		</div>
	);
}
