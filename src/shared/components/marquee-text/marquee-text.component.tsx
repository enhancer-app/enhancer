import type { MarqueeTextComponentProps } from "$types/shared/components/stream-preview.component.types.ts";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import styled, { css, keyframes } from "styled-components";

const SCROLL_SPEED_PX_PER_S = 40;
const PAUSE_S = 1;

export function MarqueeTextComponent({ text, active, className }: MarqueeTextComponentProps) {
	const outerRef = useRef<HTMLSpanElement>(null);
	const innerRef = useRef<HTMLSpanElement>(null);
	const [distance, setDistance] = useState(0);

	useLayoutEffect(() => {
		const outer = outerRef.current;
		const inner = innerRef.current;
		if (!active || !outer || !inner) {
			setDistance(0);
			return;
		}
		setDistance(Math.max(0, inner.scrollWidth - outer.clientWidth));
	}, [active, text]);

	const duration = distance / SCROLL_SPEED_PX_PER_S + PAUSE_S * 2;

	return (
		<Outer ref={outerRef} className={className} title={text}>
			<Inner ref={innerRef} $distance={distance} $duration={duration}>
				{text}
			</Inner>
		</Outer>
	);
}

const scroll = keyframes`
	0%, 15% { transform: translateX(0); }
	85%, 100% { transform: translateX(calc(-1 * var(--marquee-distance))); }
`;

const Outer = styled.span`
	display: block;
	min-width: 0;
	overflow: hidden;
	white-space: nowrap;
`;

const Inner = styled.span<{ $distance: number; $duration: number }>`
	display: inline-block;
	${({ $distance, $duration }) =>
		$distance > 0
			? css`
					--marquee-distance: ${$distance}px;
					animation: ${scroll} ${$duration}s linear infinite alternate;
				`
			: css`
					max-width: 100%;
					overflow: hidden;
					text-overflow: ellipsis;
					vertical-align: top;
				`}
`;
