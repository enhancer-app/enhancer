import { expect, test } from "bun:test";
import { placeTooltip } from "$shared/utils/tooltip-placement.utils.ts";
import type { TooltipRect } from "$types/shared/components/tooltip.component.types.ts";

const VIEWPORT = { width: 1500, height: 900 };
const PREVIEW = { width: 290, height: 260 };

function rect(left: number, top: number, width: number, height: number): TooltipRect {
	return { left, top, width, height, right: left + width, bottom: top + height };
}

test("centers a right tooltip on the row when it fits", () => {
	expect(placeTooltip(rect(4, 400, 217, 45), PREVIEW, VIEWPORT, "right")).toEqual({
		position: "right",
		left: 229,
		top: 292.5,
		arrow: 130,
	});
});

test("keeps a right tooltip inside the viewport for a row at the top edge", () => {
	const placement = placeTooltip(rect(4, 50, 217, 45), PREVIEW, VIEWPORT, "right");
	expect(placement).toMatchObject({ position: "right", left: 229, top: 8 });
	expect(placement.arrow).toBe(64.5);
});

test("keeps a right tooltip inside the viewport for a row at the bottom edge", () => {
	const placement = placeTooltip(rect(4, 860, 217, 45), PREVIEW, VIEWPORT, "right");
	expect(placement.position).toBe("right");
	expect(placement.top + PREVIEW.height).toBe(VIEWPORT.height - 8);
	expect(placement.arrow).toBe(PREVIEW.height - 12);
});

test("puts a top tooltip fully above the anchor instead of over it", () => {
	const placement = placeTooltip(rect(51, 247, 28, 28), { width: 74, height: 42 }, VIEWPORT, "top");
	expect(placement).toEqual({ position: "top", left: 28, top: 197, arrow: 37 });
	expect(placement.top + 42).toBeLessThan(247);
});

test("flips to the opposite side when the preferred side has no room", () => {
	expect(placeTooltip(rect(600, 20, 28, 28), { width: 74, height: 42 }, VIEWPORT, "top").position).toBe("bottom");
	expect(placeTooltip(rect(1400, 400, 60, 45), PREVIEW, VIEWPORT, "right").position).toBe("left");
});
