import type { ComponentChildren } from "preact";

export type TooltipPosition = "top" | "bottom" | "left" | "right";

export type TooltipRect = { top: number; right: number; bottom: number; left: number; width: number; height: number };

export type TooltipSize = { width: number; height: number };

export type TooltipPlacement = { position: TooltipPosition; left: number; top: number; arrow: number };

export type TooltipComponentProps = {
	children: ComponentChildren;
	content: ComponentChildren;
	position?: TooltipPosition;
	delay?: number;
};

export type TooltipPopoverProps = {
	anchor: HTMLElement;
	content: ComponentChildren;
	position: TooltipPosition;
	onClose: () => void;
};
