import { TooltipPopover } from "$shared/components/tooltip/tooltip.component.tsx";
import { render } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";
import styled from "styled-components";

const CONTAINER_ID = "enhancer-nickname-tooltip";
const NICKNAME_SELECTOR = "[data-enhancer-real-name]";
const HOVER_DELAY_MS = 300;

export function NicknameTooltipComponent() {
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);

	const close = useCallback(() => setAnchor(null), []);

	useEffect(() => {
		let current: HTMLElement | null = null;
		let timer: number | undefined;
		const update = (element: HTMLElement | null) => {
			if (element === current) return;
			current = element;
			window.clearTimeout(timer);
			setAnchor(null);
			if (!element) return;
			timer = window.setTimeout(() => {
				if (current === element && element.isConnected) setAnchor(element);
			}, HOVER_DELAY_MS);
		};
		const handleOver = (event: MouseEvent) => {
			const target = event.target instanceof Element ? event.target : null;
			update(target?.closest<HTMLElement>(NICKNAME_SELECTOR) ?? null);
		};
		const handleOut = (event: MouseEvent) => {
			if (!event.relatedTarget) update(null);
		};
		const handleDown = () => update(null);
		document.addEventListener("mouseover", handleOver, true);
		document.addEventListener("mouseout", handleOut, true);
		document.addEventListener("mousedown", handleDown, true);
		return () => {
			window.clearTimeout(timer);
			document.removeEventListener("mouseover", handleOver, true);
			document.removeEventListener("mouseout", handleOut, true);
			document.removeEventListener("mousedown", handleDown, true);
		};
	}, []);

	const realName = anchor?.dataset.enhancerRealName;
	if (!anchor || !realName) return null;
	return (
		<TooltipPopover
			anchor={anchor}
			position="top"
			onClose={close}
			content={
				<>
					<Caption>Nickname set with Enhancer</Caption>
					<div>
						Real name: <strong>{realName}</strong>
					</div>
				</>
			}
		/>
	);
}

export function mountNicknameTooltip(): void {
	if (document.getElementById(CONTAINER_ID)) return;
	const container = document.createElement("div");
	container.id = CONTAINER_ID;
	document.body.append(container);
	render(<NicknameTooltipComponent />, container);
}

const Caption = styled.div`
	margin-bottom: 2px;
	color: rgba(255, 255, 255, 0.6);
	font-size: 11px;
`;
