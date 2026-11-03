import { Logger } from "$shared/logger/logger.ts";
import type WorkerService from "$shared/worker/worker.service.ts";
import type { LogEntry } from "$types/shared/logger.types.ts";
import type { PlatformType } from "$types/shared/platform.types.ts";
import { useEffect, useState } from "preact/hooks";
import styled from "styled-components";

const Container = styled.div`
	width: auto;
	flex-shrink: 0;
`;

const Button = styled.button`
	display: inline-flex;
	align-items: center;
	justify-content: center;
	height: 34px;
	padding: 0 14px;
	border: none;
	border-radius: 8px;
	background: var(--settings-surface-raised);
	box-shadow: inset 0 0 0 1px var(--settings-control-border);
	color: var(--settings-text-primary);
	font: inherit;
	font-size: 13px;
	font-weight: 500;
	white-space: nowrap;
	cursor: pointer;
	transition: background 0.12s ease;

	&:hover:not(:disabled) {
		background: var(--settings-surface-hover);
	}

	&:focus-visible {
		outline: 2px solid var(--settings-accent);
		outline-offset: 2px;
	}

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
`;

const Status = styled.div<{ $error: boolean }>`
	margin-top: 6px;
	color: ${(props) => (props.$error ? "var(--settings-danger)" : "#4ade80")};
	font-size: 12px;
	text-align: right;
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
		channel: string;
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
					channel: window.enhancer.channel,
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
				<Button onClick={exportLogs} disabled={loading}>
					{loading ? "Exporting..." : "Export logs"}
				</Button>
			</Container>
			{status && <Status $error={status.error}>{status.message}</Status>}
		</div>
	);
}
