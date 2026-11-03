import { isSamePlacement, placeTooltip } from "$shared/utils/tooltip-placement.utils.ts";
import type {
	TooltipComponentProps,
	TooltipPlacement,
	TooltipPopoverProps,
	TooltipPosition,
} from "$types/shared/components/tooltip.component.types.ts";
import { createPortal } from "preact/compat";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import styled, { css, keyframes } from "styled-components";

export function TooltipPopover({ anchor, content, position, onClose }: TooltipPopoverProps) {
	const [placement, setPlacement] = useState<TooltipPlacement | null>(null);
	const tooltipRef = useRef<HTMLDivElement>(null);

	const updatePlacement = useCallback(() => {
		const tooltip = tooltipRef.current;
		if (!tooltip) return;
		const next = placeTooltip(
			anchor.getBoundingClientRect(),
			{ width: tooltip.offsetWidth, height: tooltip.offsetHeight },
			{ width: window.innerWidth, height: window.innerHeight },
			position,
		);
		setPlacement((previous) => (isSamePlacement(previous, next) ? previous : next));
	}, [anchor, position]);

	useLayoutEffect(() => {
		updatePlacement();
		const tooltip = tooltipRef.current;
		const observer = new ResizeObserver(updatePlacement);
		if (tooltip) observer.observe(tooltip);
		const handleScroll = (event: Event) => {
			if (event.target instanceof Node && event.target.contains(anchor)) onClose();
		};
		let frame = 0;
		const checkConnected = () => {
			if (!anchor.isConnected) {
				onClose();
				return;
			}
			frame = requestAnimationFrame(checkConnected);
		};
		frame = requestAnimationFrame(checkConnected);
		window.addEventListener("resize", updatePlacement);
		document.addEventListener("scroll", handleScroll, { capture: true, passive: true });
		return () => {
			observer.disconnect();
			cancelAnimationFrame(frame);
			window.removeEventListener("resize", updatePlacement);
			document.removeEventListener("scroll", handleScroll, { capture: true });
		};
	}, [anchor, updatePlacement, onClose]);

	return createPortal(
		<TooltipContent
			ref={tooltipRef}
			$position={placement?.position ?? position}
			style={
				placement
					? { left: `${placement.left}px`, top: `${placement.top}px`, "--tooltip-arrow": `${placement.arrow}px` }
					: { left: "0px", top: "0px", visibility: "hidden" }
			}
		>
			<TooltipArrow $position={placement?.position ?? position} />
			<TooltipInner>{content}</TooltipInner>
		</TooltipContent>,
		document.body,
	);
}

export function TooltipComponent({ children, content, position = "top", delay = 300 }: TooltipComponentProps) {
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

	const showTooltip = useCallback(() => {
		if (timeoutRef.current) clearTimeout(timeoutRef.current);
		timeoutRef.current = setTimeout(() => {
			const container = containerRef.current;
			if (container?.isConnected) setAnchor(container);
		}, delay);
	}, [delay]);

	const hideTooltip = useCallback(() => {
		if (timeoutRef.current) clearTimeout(timeoutRef.current);
		setAnchor(null);
	}, []);

	useEffect(() => {
		return () => {
			if (timeoutRef.current) clearTimeout(timeoutRef.current);
		};
	}, []);

	return (
		<TooltipContainer ref={containerRef} onMouseEnter={showTooltip} onMouseLeave={hideTooltip} onClick={hideTooltip}>
			{children}
			{anchor && <TooltipPopover anchor={anchor} content={content} position={position} onClose={hideTooltip} />}
		</TooltipContainer>
	);
}

const fadeIn = (offset: string) => keyframes`
	from {
		opacity: 0;
		transform: ${offset};
	}
	to {
		opacity: 1;
		transform: none;
	}
`;

const FADE_INS: Record<TooltipPosition, ReturnType<typeof keyframes>> = {
	top: fadeIn("translateY(4px)"),
	bottom: fadeIn("translateY(-4px)"),
	left: fadeIn("translateX(4px)"),
	right: fadeIn("translateX(-4px)"),
};

const TooltipContainer = styled.div`
	position: relative;
	display: inline-block;
`;

const TooltipContent = styled.div<{ $position: TooltipPosition }>`
	position: fixed;
	z-index: 99999999999;
	background: rgba(25, 25, 28, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 8px;
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
	backdrop-filter: blur(8px);
	pointer-events: none;
	animation: ${({ $position }) => FADE_INS[$position]} 0.2s ease-out;
	max-width: 300px;
	word-wrap: break-word;
`;

const TooltipInner = styled.div`
	padding: 12px 16px;
	color: #ffffff;
	font-size: 13px;
	line-height: 1.4;
`;

const ARROW_COLOR = "rgba(25, 25, 28, 0.98)";

const TooltipArrow = styled.div<{ $position: TooltipPosition }>`
	position: absolute;
	width: 0;
	height: 0;
	${({ $position }) => {
		switch ($position) {
			case "top":
				return css`
					top: 100%;
					left: var(--tooltip-arrow, 50%);
					transform: translateX(-50%);
					border-left: 6px solid transparent;
					border-right: 6px solid transparent;
					border-top: 6px solid ${ARROW_COLOR};
				`;
			case "bottom":
				return css`
					bottom: 100%;
					left: var(--tooltip-arrow, 50%);
					transform: translateX(-50%);
					border-left: 6px solid transparent;
					border-right: 6px solid transparent;
					border-bottom: 6px solid ${ARROW_COLOR};
				`;
			case "left":
				return css`
					left: 100%;
					top: var(--tooltip-arrow, 50%);
					transform: translateY(-50%);
					border-top: 6px solid transparent;
					border-bottom: 6px solid transparent;
					border-left: 6px solid ${ARROW_COLOR};
				`;
			case "right":
				return css`
					right: 100%;
					top: var(--tooltip-arrow, 50%);
					transform: translateY(-50%);
					border-top: 6px solid transparent;
					border-bottom: 6px solid transparent;
					border-right: 6px solid ${ARROW_COLOR};
				`;
		}
	}}
`;
