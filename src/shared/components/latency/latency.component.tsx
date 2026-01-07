import { TooltipComponent } from "$shared/components/tooltip/tooltip.component.tsx";
import type { Signal } from "@preact/signals";
import styled from "styled-components";

interface LatencyComponentProps {
	latencyCounter: Signal<number>;
	isLive: Signal<boolean>;
	playbackRate: Signal<number>;
	click: () => void;
}

const LatencyWrapper = styled.div`
	flex-grow: 1;
	justify-content: center;
	display: flex;
	align-items: center;
	width: max-content;
	padding: 6px 12px;
	color: #dedee3;
	font-weight: 600;
	font-size: 14px;
	transition: all 0.2s ease;
	user-select: none;

	&:hover {
		color: #ffffff;
		cursor: pointer;
		transform: translateY(-1px);
	}
`;

const StatusDot = styled.span<{ isLive: boolean }>`
	display: inline-block;
	width: 8px;
	height: 8px;
	border-radius: 50%;
	margin-right: 8px;
	background-color: ${({ isLive }) => (isLive ? "#ff4d4d" : "#888")};
`;

const PlaybackRate = styled.span`
	font-size: 11px;
	font-weight: 600;
	color:rgba(222, 222, 227, 0.5);
`;

export function LatencyComponent({ click, latencyCounter, isLive, playbackRate }: LatencyComponentProps) {
	const formatLatency = () => {
		if (latencyCounter.value === undefined || latencyCounter.value < 0 || Number.isNaN(latencyCounter.value)) {
			return "Loading...";
		}
		return `${latencyCounter.value.toFixed(2)}s`;
	};

	return (
		<TooltipComponent content={"Stream delay. Click to refresh player."} position={"bottom"}>
			<LatencyWrapper onClick={click}>
				<StatusDot isLive={isLive.value} />
				{isLive.value ? (
					<span>
						Latency: {formatLatency()}{" "}
						{playbackRate.value && playbackRate.value !== 1 && (
							<PlaybackRate>({playbackRate.value.toFixed(2)}x)</PlaybackRate>
						)}
					</span>
				) : (
					"OFFLINE"
				)}
			</LatencyWrapper>
		</TooltipComponent>
	);
}
