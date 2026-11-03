import type {
	TooltipPlacement,
	TooltipPosition,
	TooltipRect,
	TooltipSize,
} from "$types/shared/components/tooltip.component.types.ts";

export const TOOLTIP_SPACING = 8;
const ARROW_INSET = 12;

const FALLBACKS: Record<TooltipPosition, TooltipPosition[]> = {
	top: ["top", "bottom", "right", "left"],
	bottom: ["bottom", "top", "right", "left"],
	left: ["left", "right", "top", "bottom"],
	right: ["right", "left", "top", "bottom"],
};

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), Math.max(min, max));
}

function fits(position: TooltipPosition, anchor: TooltipRect, size: TooltipSize, viewport: TooltipSize): boolean {
	switch (position) {
		case "top":
			return anchor.top - TOOLTIP_SPACING - size.height >= TOOLTIP_SPACING;
		case "bottom":
			return anchor.bottom + TOOLTIP_SPACING + size.height <= viewport.height - TOOLTIP_SPACING;
		case "left":
			return anchor.left - TOOLTIP_SPACING - size.width >= TOOLTIP_SPACING;
		case "right":
			return anchor.right + TOOLTIP_SPACING + size.width <= viewport.width - TOOLTIP_SPACING;
	}
}

export function placeTooltip(
	anchor: TooltipRect,
	size: TooltipSize,
	viewport: TooltipSize,
	preferred: TooltipPosition,
): TooltipPlacement {
	const position = FALLBACKS[preferred].find((option) => fits(option, anchor, size, viewport)) ?? preferred;
	const centerX = anchor.left + anchor.width / 2;
	const centerY = anchor.top + anchor.height / 2;

	if (position === "top" || position === "bottom") {
		const left = clamp(centerX - size.width / 2, TOOLTIP_SPACING, viewport.width - size.width - TOOLTIP_SPACING);
		const top = position === "top" ? anchor.top - TOOLTIP_SPACING - size.height : anchor.bottom + TOOLTIP_SPACING;
		return { position, left, top, arrow: clamp(centerX - left, ARROW_INSET, size.width - ARROW_INSET) };
	}

	const top = clamp(centerY - size.height / 2, TOOLTIP_SPACING, viewport.height - size.height - TOOLTIP_SPACING);
	const left = position === "left" ? anchor.left - TOOLTIP_SPACING - size.width : anchor.right + TOOLTIP_SPACING;
	return { position, left, top, arrow: clamp(centerY - top, ARROW_INSET, size.height - ARROW_INSET) };
}

export function isSamePlacement(a: TooltipPlacement | null, b: TooltipPlacement): boolean {
	return !!a && a.position === b.position && a.left === b.left && a.top === b.top && a.arrow === b.arrow;
}
