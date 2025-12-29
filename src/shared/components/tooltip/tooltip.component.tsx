import type { ComponentChildren } from "preact";
import { createPortal } from "preact/compat";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import styled from "styled-components";

interface TooltipComponentProps {
	children: ComponentChildren;
	content: ComponentChildren;
	position?: "top" | "bottom" | "left" | "right";
	delay?: number;
}

const TOOLTIP_SHOW_EVENT = "ENHANCER_TOOLTIP";
let tooltipIdCounter = 0;

export function useTooltipPosition(
	containerRef: preact.RefObject<HTMLElement>,
	tooltipRef: preact.RefObject<HTMLElement>,
	isVisible: boolean,
	position: string,
) {
	useEffect(() => {
		if (!isVisible || !containerRef.current || !tooltipRef.current) return;
		const container = containerRef.current.getBoundingClientRect();
		const tooltip = tooltipRef.current;
		const spacing = 8;
		let x = 0;
		let y = 0;
		switch (position) {
			case "top":
				x = container.left + container.width / 2;
				y = container.top - spacing;
				tooltip.style.left = `${x}px`;
				tooltip.style.top = `${y}px`;
				break;
			case "bottom":
				x = container.left + container.width / 2;
				y = container.bottom + spacing;
				tooltip.style.left = `${x}px`;
				tooltip.style.top = `${y}px`;
				break;
			case "left":
				x = container.left - spacing;
				y = container.top + container.height / 2;
				tooltip.style.left = `${x}px`;
				tooltip.style.top = `${y}px`;
				break;
			case "right":
				x = container.right + spacing;
				y = container.top + container.height / 2;
				tooltip.style.left = `${x}px`;
				tooltip.style.top = `${y}px`;
				break;
		}
		const tooltipRect = tooltip.getBoundingClientRect();
		const viewport = {
			width: window.innerWidth,
			height: window.innerHeight,
		};
		if (tooltipRect.right > viewport.width - spacing) {
			tooltip.style.left = `${viewport.width - tooltipRect.width - spacing}px`;
		}
		if (tooltipRect.left < spacing) {
			tooltip.style.left = `${spacing}px`;
		}
		if (tooltipRect.bottom > viewport.height - spacing) {
			tooltip.style.top = `${viewport.height - tooltipRect.height - spacing}px`;
		}
		if (tooltipRect.top < spacing) {
			tooltip.style.top = `${spacing}px`;
		}
	}, [isVisible, position]);
}

export function TooltipComponent({ children, content, position = "top", delay = 300 }: TooltipComponentProps) {
	const [isVisible, setIsVisible] = useState(false);
	const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);
	const [actualPosition, setActualPosition] = useState(position);
	const containerRef = useRef<HTMLDivElement>(null);
	const tooltipRef = useRef<HTMLDivElement>(null);
	const idRef = useRef(++tooltipIdCounter);

	const calculatePosition = useCallback(() => {
		if (!containerRef.current || !tooltipRef.current) return;
		const container = containerRef.current.getBoundingClientRect();
		const tooltip = tooltipRef.current.getBoundingClientRect();
		const viewport = {
			width: window.innerWidth,
			height: window.innerHeight,
		};
		const spacing = 8;
		let newPosition = position;
		const positions = {
			top: {
				fits:
					container.top - tooltip.height - spacing > spacing &&
					container.left + container.width / 2 - tooltip.width / 2 > spacing &&
					container.left + container.width / 2 + tooltip.width / 2 < viewport.width - spacing,
			},
			bottom: {
				fits:
					container.bottom + tooltip.height + spacing < viewport.height - spacing &&
					container.left + container.width / 2 - tooltip.width / 2 > spacing &&
					container.left + container.width / 2 + tooltip.width / 2 < viewport.width - spacing,
			},
			left: {
				fits:
					container.left - tooltip.width - spacing > spacing &&
					container.top + container.height / 2 - tooltip.height / 2 > spacing &&
					container.top + container.height / 2 + tooltip.height / 2 < viewport.height - spacing,
			},
			right: {
				fits:
					container.right + tooltip.width + spacing < viewport.width - spacing &&
					container.top + container.height / 2 - tooltip.height / 2 > spacing &&
					container.top + container.height / 2 + tooltip.height / 2 < viewport.height - spacing,
			},
		};
		if (positions[position].fits) {
			newPosition = position;
		} else {
			const fallbackOrder: Array<keyof typeof positions> = ["top", "bottom", "right", "left"];
			newPosition = fallbackOrder.find((pos) => positions[pos].fits) || position;
		}
		setActualPosition(newPosition);
	}, [position]);

	const showTooltip = useCallback(() => {
		if (timeoutId) clearTimeout(timeoutId);
		window.dispatchEvent(new CustomEvent(TOOLTIP_SHOW_EVENT, { detail: idRef.current }));
		const id = setTimeout(() => {
			setIsVisible(true);
			setTimeout(calculatePosition, 0);
		}, delay);
		setTimeoutId(id);
	}, [timeoutId, delay, calculatePosition]);

	const hideTooltip = useCallback(() => {
		if (timeoutId) clearTimeout(timeoutId);
		setIsVisible(false);
	}, [timeoutId]);

	useEffect(() => {
		const handler = (e: Event) => {
			const detail = (e as CustomEvent).detail;
			if (detail !== idRef.current) setIsVisible(false);
		};
		window.addEventListener(TOOLTIP_SHOW_EVENT, handler);
		return () => window.removeEventListener(TOOLTIP_SHOW_EVENT, handler);
	}, []);

	useEffect(() => {
		if (!isVisible) return;
		calculatePosition();
		const handleResize = () => calculatePosition();
		const handleScroll = () => setIsVisible(false);
		window.addEventListener("resize", handleResize);
		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => {
			window.removeEventListener("resize", handleResize);
			window.removeEventListener("scroll", handleScroll);
		};
	}, [isVisible, calculatePosition]);

	useTooltipPosition(containerRef, tooltipRef, isVisible, actualPosition);

	return (
		<TooltipContainer ref={containerRef} onMouseEnter={showTooltip} onMouseLeave={hideTooltip}>
			{children}
			{isVisible &&
				createPortal(
					<TooltipContent ref={tooltipRef} position={actualPosition}>
						<TooltipArrow position={actualPosition} />
						<TooltipInner>{content}</TooltipInner>
					</TooltipContent>,
					document.body,
				)}
		</TooltipContainer>
	);
}

const TooltipContainer = styled.div`
	position: relative;
	display: inline-block;
`;

const TooltipContent = styled.div<{ position: string }>`
	position: fixed;
	z-index: 99999999999;
	background: rgba(25, 25, 28, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 8px;
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
	backdrop-filter: blur(8px);
	pointer-events: none;
	animation: tooltipFadeIn 0.2s ease-out;
	max-width: 300px;
	word-wrap: break-word;
	${({ position }) => {
		switch (position) {
			case "top":
				return "transform: translateX(-50%);";
			case "bottom":
				return "transform: translateX(-50%);";
			case "left":
				return "transform: translateY(-50%);";
			case "right":
				return "transform: translateY(-50%);";
			default:
				return "";
		}
	}};
	@keyframes tooltipFadeIn {
		from {
			opacity: 0;
			transform: ${({ position }) => {
				switch (position) {
					case "top":
						return "translateX(-50%) translateY(4px)";
					case "bottom":
						return "translateX(-50%) translateY(-4px)";
					case "left":
						return "translateY(-50%) translateX(4px)";
					case "right":
						return "translateY(-50%) translateX(-4px)";
					default:
						return "translateX(-50%) translateY(4px)";
				}
			}};
		}
		to {
			opacity: 1;
			transform: ${({ position }) => {
				switch (position) {
					case "top":
					case "bottom":
						return "translateX(-50%) translateY(0)";
					case "left":
					case "right":
						return "translateY(-50%) translateX(0)";
					default:
						return "translateX(-50%) translateY(0)";
				}
			}};
		}
	}
`;

const TooltipInner = styled.div`
	padding: 12px 16px;
	color: #ffffff;
	font-size: 13px;
	line-height: 1.4;
`;

const TooltipArrow = styled.div<{ position: string }>`
	position: absolute;
	width: 0;
	height: 0;
	${({ position }) => {
		switch (position) {
			case "top":
				return `
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 6px solid rgba(25, 25, 28, 0.98);
        `;
			case "bottom":
				return `
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-bottom: 6px solid rgba(25, 25, 28, 0.98);
        `;
			case "left":
				return `
          left: 100%;
          top: 50%;
          transform: translateY(-50%);
          border-top: 6px solid transparent;
          border-bottom: 6px solid transparent;
          border-left: 6px solid rgba(25, 25, 28, 0.98);
        `;
			case "right":
				return `
          right: 100%;
          top: 50%;
          transform: translateY(-50%);
          border-top: 6px solid transparent;
          border-bottom: 6px solid transparent;
          border-right: 6px solid rgba(25, 25, 28, 0.98);
        `;
			default:
				return "";
		}
	}}
`;
