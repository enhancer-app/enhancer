import { ChannelTooltipContent } from "$shared/components/cross-platform-follows/channel-tooltip.component.tsx";
import { TooltipPopover } from "$shared/components/tooltip/tooltip.component.tsx";
import type {
	SidebarChannel,
	SidebarChannelHoverProps,
} from "$types/shared/components/cross-platform-follows.component.types.ts";
import { useCallback, useEffect, useState } from "preact/hooks";

const HOVER_DELAY_MS = 400;

export function SidebarChannelHoverComponent({
	rowSelector,
	readChannel,
	resolvePreviewUrl,
}: SidebarChannelHoverProps) {
	const [hover, setHover] = useState<{ row: HTMLElement; channel: SidebarChannel; now: number } | null>(null);

	const close = useCallback(() => setHover(null), []);

	useEffect(() => {
		let current: HTMLElement | null = null;
		let timer: number | undefined;
		const update = (row: HTMLElement | null) => {
			if (row === current) return;
			current = row;
			window.clearTimeout(timer);
			setHover(null);
			if (!row) return;
			timer = window.setTimeout(() => {
				const channel = row.isConnected ? readChannel(row) : null;
				if (channel && current === row) setHover({ row, channel, now: Date.now() });
			}, HOVER_DELAY_MS);
		};
		const handleOver = (event: MouseEvent) => {
			const target = event.target instanceof Element ? event.target : null;
			update(target?.closest<HTMLElement>(rowSelector) ?? null);
		};
		const handleOut = (event: MouseEvent) => {
			if (!event.relatedTarget) update(null);
		};
		const handleDown = () => {
			window.clearTimeout(timer);
			setHover(null);
		};
		document.addEventListener("mouseover", handleOver, true);
		document.addEventListener("mouseout", handleOut, true);
		document.addEventListener("mousedown", handleDown, true);
		return () => {
			window.clearTimeout(timer);
			document.removeEventListener("mouseover", handleOver, true);
			document.removeEventListener("mouseout", handleOut, true);
			document.removeEventListener("mousedown", handleDown, true);
		};
	}, [rowSelector, readChannel]);

	if (!hover) return null;
	return (
		<TooltipPopover
			anchor={hover.row}
			position="right"
			onClose={close}
			content={<ChannelTooltipContent channel={hover.channel} now={hover.now} resolvePreviewUrl={resolvePreviewUrl} />}
		/>
	);
}
